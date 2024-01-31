import { retrieveEraBlockRanges } from "./utils";
import { setTimeout } from "node:timers/promises";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify } from "csv-stringify/sync";

async function main() {
	const blockRanges = await retrieveEraBlockRanges();
	const lines = [];

	for (const blockRange of blockRanges) {
		const eraIndex = blockRange.eraIndex;
		const range = [blockRange.blockStart, blockRange.blockEnd] as [number, number];
		const total = await fetchTransfersTotal(range);
		console.log(`Processing range: ${range[0]}-${range[1]}, era: ${eraIndex}`);
		lines.push([
			eraIndex,
			range[0],
			range[1],
			total.totalROOT,
			total.totalXRP,
			total.totalVTX,
			total.totalETH,
			total.totalASTO,
		]);

		await setTimeout(250);
	}

	const output = stringify([
		[
			"Era Index",
			"From Block",
			"To Block",
			"Total ROOT",
			"Total XRP",
			"Total VTX",
			"Total ETH",
			"Total ASTO",
		],
		...lines,
	]);
	writeFileSync(resolve(`${__dirname}/../data/2_era_transfers_volume.csv`), output, { flag: "w+" });
}

main().then(() => process.exit(0));

async function fetchTransfersTotal(blockRange: [number, number]) {
	const endpoint = "https://rootnet-mainnet.hasura.app/v1/graphql";
	const {
		data: {
			balances: { transfer: transfers },
		},
	} = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query: `
{
  balances {
    transfer(where: {block_number: {_gte: ${blockRange[0]}}, _and: {block_number: {_lte: ${blockRange[1]}}}, status: {_eq: "TRANSFERRED"}}, order_by: {block_number: asc}) {
      amount
      asset_id
      status
      block_number
    }
  }
}

	`,
		}),
	}).then(
		(res) =>
			res.json() as unknown as {
				data: { balances: { transfer: { asset_id: string; amount: number }[] } };
			}
	);

	const total = transfers.reduce<{
		totalROOT: number;
		totalXRP: number;
		totalASTO: number;
		totalETH: number;
		totalVTX: number;
	}>(
		(total, transfer) => {
			const { asset_id, amount } = transfer;
			switch (asset_id) {
				case "ROOT":
					total.totalROOT += amount;
					break;
				case "2":
					total.totalXRP += amount;
					break;
				case "3":
					total.totalVTX += amount;
					break;
				case "1124":
					total.totalETH += amount;
					break;
				case "4196":
					total.totalASTO += amount;
					break;
				default:
					console.warn({ asset_id, amount });
					break;
			}
			return total;
		},
		{ totalROOT: 0, totalXRP: 0, totalASTO: 0, totalETH: 0, totalVTX: 0 }
	);

	return {
		totalROOT: total.totalROOT / 10 ** 6,
		totalXRP: total.totalXRP / 10 ** 6,
		totalVTX: total.totalVTX / 10 ** 6,
		totalETH: total.totalETH / 10 ** 18,
		totalASTO: total.totalASTO / 10 ** 18,
	};
}
