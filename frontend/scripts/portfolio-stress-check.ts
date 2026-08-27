import { applyStressScenario } from "../src/server/portfolio/stress";
import { allTokensFixture, mockPortfolioFixture } from "../src/server/portfolio/stressFixtures";
import { STRESS_SCENARIOS } from "../src/server/portfolio/scenarios";

function runTests() {
  console.log("=== Portfolio Stress Testing ===");
  console.log(`Testing with base portfolio value: $${mockPortfolioFixture.totalValueUsd.toFixed(2)}`);
  
  for (const scenario of STRESS_SCENARIOS) {
    console.log(`\n--- Running Scenario: ${scenario.name} ---`);
    console.log(`Description: ${scenario.description}`);
    
    const result = applyStressScenario(mockPortfolioFixture, scenario);
    
    console.log(`Scenario ID: ${result.scenarioId} v${result.scenarioVersion}`);
    console.log(`Base Value: $${result.delta.originalValueUsd.toFixed(2)}`);
    console.log(`Stressed Value: $${result.delta.stressedValueUsd.toFixed(2)}`);
    console.log(`Delta: $${result.delta.valueDeltaUsd.toFixed(2)} (${result.delta.percentageDelta.toFixed(2)}%)`);
    console.log(`Affected Holdings: ${result.affectedHoldings.join(", ") || "None"}`);
    
    console.log("Assumptions:");
    for (const assumption of result.assumptions) {
      console.log(`  - ${assumption}`);
    }
  }

  console.log("\n=== Extended Test: Portfolio with XLM ===");
  const stellarScenario = STRESS_SCENARIOS[0]; // Just picking market crash
  const xlmResult = applyStressScenario(allTokensFixture, stellarScenario);
  console.log(`Base Value: $${xlmResult.delta.originalValueUsd.toFixed(2)}`);
  console.log(`Stressed Value: $${xlmResult.delta.stressedValueUsd.toFixed(2)}`);
  console.log(`Delta: $${xlmResult.delta.valueDeltaUsd.toFixed(2)} (${xlmResult.delta.percentageDelta.toFixed(2)}%)`);
  console.log(`Affected Holdings: ${xlmResult.affectedHoldings.join(", ") || "None"}`);
}

runTests();
