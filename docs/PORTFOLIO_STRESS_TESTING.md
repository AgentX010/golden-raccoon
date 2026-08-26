# Portfolio Stress Testing

This document details the portfolio stress testing functionality.

## Overview

The Portfolio Stress Testing feature allows users to simulate various market scenarios on their wallet's holdings to understand the potential impact on their portfolio's value and risk. This functionality is crucial for risk management and scenario planning in volatile markets.

## Architecture

The system is composed of the following pieces:

1.  **Stress Testing API Endpoint (`/api/portfolio/stress/route.ts`)**:
    *   A `POST` endpoint that accepts a `PortfolioSnapshot` and a `scenarioId`.
    *   It retrieves the predefined scenario configuration.
    *   It applies the logic using `applyStressScenario` from `stress.ts`.
    *   Returns a `PortfolioStressResult` containing the `baseSnapshot`, `stressedSnapshot`, `delta`, and `assumptions`.

2.  **Scenarios Configuration (`scenarios.ts`)**:
    *   Defines scenarios such as "20% Market Crash", "Stablecoin Depeg", and "Memecoin Collapse".
    *   Each scenario specifies changes (e.g., price multipliers, fixed prices, or depegs) for targets (e.g., "all", "stablecoins", "memecoins").

3.  **Stress Logic (`stress.ts`)**:
    *   Iterates through portfolio holdings.
    *   Applies the specified price manipulations.
    *   Calculates the new total value and computes the deltas between the original and stressed portfolios.

4.  **UI Component (`PortfolioStressPanel.tsx`)**:
    *   Provides an accessible interface for selecting a scenario and running the test.
    *   Displays the before/after values and the absolute/percentage delta with visual indicators (colors, icons).
    *   Lists the specific assumptions that were applied during the test.

## Accessibility

The `PortfolioStressPanel` is designed with accessibility in mind:
*   Includes `aria-label` for semantic grouping.
*   Uses `aria-live="polite"` and `aria-atomic="true"` on the results container to announce changes to screen readers.
*   Form elements have accessible labels.
*   Loading states use `aria-busy` and `aria-hidden` properly.
*   Error messages utilize the `role="alert"` attribute.

## Future Enhancements

*   Custom scenario builder for users.
*   Integration with historical price data for backtesting.
*   Agent-driven recommendations based on stress test vulnerabilities (e.g., "Your portfolio is highly sensitive to a stablecoin depeg, consider diversifying stablecoins").
