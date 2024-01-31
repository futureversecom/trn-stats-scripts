import "@therootnetwork/api-types";
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
		console.log(`Processing range: ${range[0]}-${range[1]}, era: ${eraIndex}`);
		const substrate = await fetchSubstrateCalls(range);
		const evm = await fetchEVMCalls(range);
		const activeSubstrateWallets = Object.keys(substrate.active).length;
		const activeEVMWallets = Object.keys(evm.active).length;
		const totalTransactions = substrate.extrinsics.length + evm.transactions.length;
		const totalCalls = substrate.calls.length;

		lines.push([
			eraIndex,
			...range,
			activeSubstrateWallets + activeEVMWallets,
			totalTransactions + totalCalls,
		]);

		await setTimeout(250);
	}

	const output = stringify([
		["Era Index", "From Block", "To Block", "Active Wallets", "Transactions"],
		...lines,
	]);
	writeFileSync(resolve(`${__dirname}/../data/1_era_active_wallets.csv`), output, { flag: "w+" });
}

main().then(() => process.exit(0));

async function fetchSubstrateCalls(blockRange: [number, number]) {
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
	    block(where: {height: {_gte: ${blockRange[0]}}, _and: {height: {_lte: ${blockRange[1]}}, extrinsics: {signature: {_is_null: false}}}, extrinsics: {}}, order_by: {height: desc}) {
	      height
	      timestamp
	      extrinsics {
	        from: signature
	        id
	      }
				calls {
					name
					origin
				}
	    }
	  }
	}
	`,
		}),
	}).then((res) => res.json());

	const extrinsics = blocks
		.map((block: { extrinsics: any }) => block.extrinsics)
		.flat()
		.filter((extrinsic: { from: string }) => !!extrinsic.from)
		.map((extrinsic: { from: { address: any } }) => {
			const {
				from: { address: from },
			} = extrinsic;
			return { ...extrinsic, from };
		});
	const calls = blocks
		.map((block: { calls: any }) => block.calls)
		.flat()
		.filter(
			(call: { origin?: { value?: { __kind?: string } } }) =>
				call?.origin?.value && call.origin.value.__kind !== "None"
		);
	const active = (extrinsics as { from: string }[]).reduce(
		(active, item) => {
			if (!active[item.from]) active[item.from] = 0;
			active[item.from] += 1;
			return active;
		},
		{} as Record<string, any>
	);
	return { extrinsics, calls, active };
}

async function fetchEVMCalls(blockRange: [number, number]) {
	const endpoint =
		"https://ap-southeast-2.aws.realm.mongodb.com/api/client/v2.0/app/mainnet-explorer-app-ldwek/graphql";

	const {
		data: { transactions },
	} = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"apiKey": "5psWstFi2QNHiKzKpBzeHipcoccCqyJ7wcBqsA6apDnIfRaJY2bR9xMugzaJErTu",
		},
		body: JSON.stringify({
			query: `
{
  transactions(query: {AND: [{blockNumber_gte:${blockRange[0]} }, {blockNumber_lte:${blockRange[1]} }]}, limit: 10, sortBy: BLOCKNUMBER_DESC) {
    transactionHash
    from
  }
}
`,
		}),
	}).then((res) => res.json());

	const active = (transactions as { from: string }[]).reduce(
		(active, item) => {
			if (!active[item.from]) active[item.from] = 0;
			active[item.from] += 1;

			return active;
		},
		{} as Record<string, any>
	);

	return { transactions, active };
}
