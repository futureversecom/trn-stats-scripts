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
		const { totalCollection, totalNFT } = await fetchMintingTotal([blockStart, blockEnd]);
		console.log(`Processing range: ${blockStart}-${blockEnd}, era: ${eraIndex}`);
		lines.push([eraIndex, blockStart, blockEnd, totalCollection, totalNFT]);
		await setTimeout(250);
	}

	const output = stringify([
		["Era Index", "From Block", "To Block", "Total Minted Collection", "Total Mint NFTs"],
		...lines,
	]);
	writeFileSync(resolve(`${__dirname}/../data/6_era_nft_mint_volume.csv`), output, { flag: "w+" });
}

main().then(() => process.exit(0));

async function fetchMintingTotal(blockRange: [number, number]) {
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
    block(where: {height: {_gte: ${blockRange[0]}}, _and: {height: {_lte: ${blockRange[1]}}}, events: {name: {_eq: "Nft.Mint"}}}) {
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
			const bridgedMintEvents = events.filter(({ name }) => name === "Nft.Mint");
			return bridgedMintEvents.map(({ args }) => args);
		})
		.flat() as { collectionId: number; end: number; start: number }[];

	const { totalCollection, totalNFT } = records.reduce<{
		totalCollection: number[];
		totalNFT: number;
	}>(
		(total, record) => {
			const { collectionId, end, start } = record;

			if (!total.totalCollection.includes(collectionId)) total.totalCollection.push(collectionId);
			total.totalNFT += end - start + 1;

			return total;
		},
		{ totalCollection: [], totalNFT: 0 }
	);

	return {
		totalCollection: totalCollection.length,
		totalNFT,
	};
}
