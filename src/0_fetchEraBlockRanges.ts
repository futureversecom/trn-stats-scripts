import { ApiPromise } from "@polkadot/api";
import { getApiOptions, getPublicProvider } from "@therootnetwork/api";
import "@therootnetwork/api-types";

import { stringify } from "csv-stringify/sync";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

export async function main() {
	const api = await ApiPromise.create({
		...getApiOptions(),
		...getPublicProvider("root"),
	});

	const events = await fetchEraPaidEvents(api);

	const output = stringify([
		["Era Index", "Block Start", "Block Start Hash", "Block End", "Block End Hash"],
		...Object.values(events.map((event) => Object.values(event))),
	]);

	writeFileSync(resolve(`${__dirname}/../data/0_era_block_ranges.csv`), output, { flag: "w+" });
}

main().then(() => process.exit(0));

async function fetchEraPaidEvents(api: ApiPromise) {
	const query = `
{
  archive {
    event(where: {name: {_eq: "Staking.EraPaid"}}, order_by: {block_id: asc}) {
      name
      args
      block_id
    }
  }
}
`;

	const endpoint = "https://rootnet-mainnet.hasura.app/v1/graphql";
	const {
		data: {
			archive: { event: events },
		},
	} = (await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ query }),
	}).then((res) => res.json())) as {
		data: {
			archive: {
				event: { name: string; args: { eraIndex: number } | [number]; block_id: string }[];
			};
		};
	};

	return await Promise.all(
		[
			{ eraIndex: 0, blockStart: 0, blockEnd: parseInt(events[0]?.block_id.split("_")[0], 10) - 1 },
			...events
				.map((event, index) => {
					const { name, args, block_id } = event;
					const eraIndex = (Array.isArray(args) ? args[0] : args.eraIndex) + 1;
					const blockStart = parseInt(block_id.split("_")[0], 10);
					const blockEnd = events[index + 1]
						? parseInt(events[index + 1]?.block_id.split("_")[0]) - 1
						: undefined;

					if (!blockEnd) return;
					return { eraIndex, blockStart, blockEnd };
				})
				.filter(Boolean),
		].map(async (record) => {
			const { eraIndex, blockStart, blockEnd } = record!;
			const blockStartHash = await api.rpc.chain.getBlockHash(blockStart);
			const blockEndHash = await api.rpc.chain.getBlockHash(blockEnd);
			return {
				eraIndex,
				blockStart,
				blockStartHash: blockStartHash.toHex(),
				blockEnd,
				blockEndHash: blockEndHash.toHex(),
			};
		})
	);
}
