# Kraken/EDF energy data viewer

Very hacky data viewer for the [Octopus Energy Kraken](https://kraken.tech) GraphQL API. Designed to work with the EDF Kraken (at `api.edfgb-kraken.energy`), but I assume it'd work with Octopus' own running at `api.octopus.energy`.

You can just log in with your normal credentials (ie. the same ones you use to log into the EDF app).

Currently the timeframe & period for the data viewer is hard coded so you'll have to edit the index.tsx file to change it.