import "@therootnetwork/api-types";
import { ApiPromise } from "@polkadot/api";
import { getApiOptions, getPublicProvider } from "@therootnetwork/api";

import { retrieveEraBlockRanges } from "./utils";
import { setTimeout } from "node:timers/promises";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify } from "csv-stringify/sync";
import { ApiDecoration } from "@polkadot/api/types";

async function main() {
	const api = await ApiPromise.create({
		...getApiOptions(),
		...getPublicProvider("root"),
	});

	const blockRanges = await retrieveEraBlockRanges();
	const lines = [];

	for (const blockRange of blockRanges) {
		const { eraIndex, blockStart, blockEnd, blockEndHash } = blockRange;
		const apiAt = await api.at(blockEndHash);
		const staking = await fetchStakingVolume(apiAt, eraIndex);
		console.log(`Processing range: ${blockStart}-${blockEnd}, era: ${eraIndex}`);
		lines.push([eraIndex, blockStart, blockEnd, staking.totalStake, staking.totalStakers]);

		await setTimeout(1000);
	}

	const output = stringify([
		["Era Index", "From Block", "To Block", "Total Stake", "Total Stakers"],
		...lines,
	]);
	writeFileSync(resolve(`${__dirname}/../data/3_era_staking_volume.csv`), output, { flag: "w+" });
}

main().then(() => process.exit(0));

async function fetchStakingVolume(api: ApiDecoration<"promise">, eraIndex: number) {
	const totalStake = await api.query.staking.erasTotalStake(eraIndex);
	const validators = await fetchValidators(api);
	const stakes = await api.query.staking.erasStakers.multi(
		validators.map((validator) => [eraIndex, validator])
	);

	const totalStakers = stakes.reduce((totalStakers, stake) => {
		if (stake.own.isEmpty) return totalStakers;
		return (totalStakers += 1 + stake.others.toArray().length); // 1 validator + other nominators
	}, 0);

	return {
		totalStake: totalStake.toNumber() / 10 ** 6,
		totalStakers,
	};
}

async function fetchValidators(api: ApiDecoration<"promise">) {
	const entries = await api.query.staking.validators.entries();
	return entries.map(([key]) => (key.toHuman() as string[]).shift());
}
