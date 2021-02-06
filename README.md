# Keeper

This is the main repository for the Keeper project.

## Introduction

Keeper is a service for [Keep Network](https://keep.network/) Node Operators to help prevent liquidations due to undercollateralization.

You can read more about this project at our [blog](https://blog.chronologic.network/) and https://blog.chronologic.network/draft-chronologic-is-awarded-grant-from-keep-network-7c3d0e36a4be

## Project overview

The project consists of the following repositories:

- https://github.com/chronologic/keeper-service (this repository)
- https://github.com/chronologic/keeper-api
- https://github.com/chronologic/keeper-ui
- https://github.com/chronologic/keeper-db
- https://github.com/chronologic/keeper-payment-contract

## Repository overview

This repository holds the core logic of the Keeper service.
Its main responsibilities are:

- updating the list of active deposits
- checking collateralization of deposits
- executing the redeem/mint cycle for undercollateralized deposits
- monitoring system asset balances (ETH/TBTC/BTC)
- monitoring users' asset balances (ETH)
- processing users' payments for the service
- sending email notifications

#### ENV VARS

#### DEVELOPMENT

#### DEPLOYMENT (+ MONITORING)

#### Liquidation Prevention Process

#### FUND WITHDRAWALS (FOR USERS)

#### EXCEPTION SCENARIO (out of TBTC)

### Additional Links

- Website: https://chronologic.network/
- Twitter: https://twitter.com/chronologiceth
- Medium: https://blog.chronologic.network/
- Telegram: https://t.me/chronologicnetwork
- Github: https://github.com/chronologic/
