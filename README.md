# TRN Stats Scripts

A collection of scripts to generate several key stats of the Root Network

- Run `pnpm install` first to install dependency
- Run `pnpm call src/0_era_block_ranges.ts` to generate the block ranges data by era
- Run any other scripts as required, e.g `pnpm call src/1_fetchActiveWallets.ts`

## Hasura Endpoints

Mainnet: https://rootnet-mainnet.hasura.app/v1/graphql
Mainnet Playground: https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Frootnet-mainnet.hasura.app%2Fv1%2Fgraphql
