import { retrieveEraBlockRanges } from "./utils";
import { setTimeout } from "node:timers/promises";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify } from "csv-stringify/sync";

async function main() {
	const blockRanges = await retrieveEraBlockRanges();
	const lines = [];

	for (const blockRange of blockRanges) {
		const { eraIndex, blockStart, blockEnd } = blockRange;
		const { totalXRP, totalETH, totalASTO } = await fetchBridgingTotal([blockStart, blockEnd]);
		console.log(`Processing range: ${blockStart}-${blockEnd}, era: ${eraIndex}`);
		lines.push([eraIndex, blockStart, blockEnd, totalXRP, totalETH, totalASTO]);
		await setTimeout(250);
	}

	const output = stringify([
		[
			"Era Index",
			"From Block",
			"To Block",
			"Total Bridged XRP",
			"Total Bridged ETH",
			"Total Bridged ASTO",
		],
		...lines,
	]);
	writeFileSync(resolve(`${__dirname}/../data/4_era_erc20_bridge_volume.csv`), output, {
		flag: "w+",
	});
}

main().then(() => process.exit(0));

async function fetchBridgingTotal(blockRange: [number, number]) {
	const endpoint = "https://rootnet-mainnet.hasura.app/v1/graphql";
	const {
		data: {
			archive: { block: blocks },
		},
	} = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query: `
{
  archive {
    block(where: {height: {_gte: ${blockRange[0]}}, _and: {height: {_lte: ${blockRange[1]}}}, events: {name: {_eq: "Assets.Issued"}, extrinsic_id: {_is_null: true}}}) {
      id
      events {
        name
        args
      }
    }
  }
}
	`,
		}),
	}).then(
		(res) =>
			res.json() as unknown as {
				data: { archive: { block: { id: string; events: { name: string; args: {} }[] }[] } };
			}
	);

	const records = blocks
		.map(({ events }) => {
			const assetsIssuedEvents = events.filter(({ name }) => name === "Assets.Issued");

			return assetsIssuedEvents.map(({ args }) => args);
		})
		.flat() as { assetId: number; totalSupply: string }[];

	const { totalXRP, totalETH, totalASTO } = records.reduce<{
		totalXRP: bigint;
		totalETH: bigint;
		totalASTO: bigint;
	}>(
		(total, record) => {
			const { assetId, totalSupply } = record;

			switch (assetId) {
				case 2:
					total.totalXRP += BigInt(totalSupply);
					break;
				case 1124:
					total.totalETH += BigInt(totalSupply);
					break;
				case 4196:
					total.totalASTO += BigInt(totalSupply);
					break;
			}

			return total;
		},
		{ totalXRP: 0n, totalETH: 0n, totalASTO: 0n }
	);

	return {
		totalXRP: Number((totalXRP * 10000n) / BigInt(10 ** 6)) / 10000,
		totalETH: Number((totalETH * 10000n) / BigInt(10 ** 18)) / 10000,
		totalASTO: Number((totalASTO * 10000n) / BigInt(10 ** 18)) / 10000,
	};
}
