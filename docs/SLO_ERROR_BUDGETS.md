# SLO and Error Budgets

This document outlines the Service Level Objectives (SLOs) and Error Budgets for the application.

## Ownership and Targets

- **Scan Completion**: 99.0%
- **Quote Availability**: 99.5%
- **Simulation Success**: 99.0%
- **Transaction Observation**: 99.9%
- **Stellar Ledger Lag**: 99.0%
- **API Latency**: 99.0%

## Maintenance Windows
Maintenance windows do not burn error budget if scheduled and communicated in advance.

## Thresholds
- **Warning**: > 2x Burn Rate
- **Critical**: > 10x Burn Rate

Incident timeline uses deduplicated events to show the lifecycle (open, update, recover) of any issues affecting these SLOs.
