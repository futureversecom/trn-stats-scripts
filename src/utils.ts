import { createReadStream } from "node:fs";
import { parse } from "csv-parse";

export interface EraBlockRange {
	eraIndex: number;
	blockStart: number;
	blockStartHash: string;
	blockEnd: number;
	blockEndHash: string;
}

export async function retrieveEraBlockRanges() {
	return new Promise<EraBlockRange[]>((resolve, reject) => {
		let records: EraBlockRange[] = [];
		createReadStream(`${__dirname}/../data/0_era_block_ranges.csv`)
			.pipe(parse())
			.on("error", (error) => reject(error))
			.on("data", (row) => {
				const [eraIndex, blockStart, blockStartHash, blockEnd, blockEndHash] = row;
				records.push({
					eraIndex,
					blockStart,
					blockStartHash,
					blockEnd,
					blockEndHash,
				});
			})
			.on("end", () => {
				records.shift();
				resolve(records);
			});
	});
}
