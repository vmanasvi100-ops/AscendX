
import dotenv from 'dotenv';
import { generateDetailedFeedback } from './services/feedbackService.js';

dotenv.config();

async function test() {
  console.log("Testing generateDetailedFeedback...");
  try {
    const result = await generateDetailedFeedback({
      transcript: "I was a project manager at Google. I led a team of 10 people. We delivered the project on time and under budget. The result was a 20% increase in efficiency.",
      jobRequirements: "Project management, leadership, efficiency.",
      targetRole: "Senior Project Manager",
      companyName: "Google",
      condition: 'scaffolded',
      phaseProgression: "Phase 1 -> Phase 2 -> Phase 3"
    });
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Crash detected:", err);
  }
}

test();
