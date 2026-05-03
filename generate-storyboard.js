#!/usr/bin/env node
/**
 * CM01 Storyboard Generator
 * Generates 3 reference images for the "365 días" campaign using fal.ai
 */

const { fal } = require('@fal-ai/client');
require('dotenv').config({ path: '/Volumes/DEV/pixelcraft/.env.local' });

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error('FAL_KEY not found in .env.local');
  process.exit(1);
}

fal.config({ credentials: FAL_KEY });

const OUTPUT_DIR = '/Volumes/DEV/farmacias-madero/campanas/2025-06/borradores/cm01-365dias/storyboard';
const { execSync } = require('child_process');
execSync(`mkdir -p ${OUTPUT_DIR}`);

// Scene prompts for image generation (Flux Pro for photorealistic)
const scenes = [
  {
    id: 'escena-1',
    prompt: 'Photorealistic scene. A woman in her 40s, carrying a small bag, walking up to a neighborhood pharmacy in Mexico during Día de Muertos. The store has an ofrenda visible in the window with cempasúchil flowers, marigolds, and photos of loved ones. A worker is flipping the sign to "CERRADO" — the warm orange glow of the ofrenda contrasts with the disappointment on the woman\'s face. Golden hour lighting, street-level view, cinematic composition. Mexico City neighborhood aesthetic. No text in image.',
    aspectRatio: '16:9',
    model: 'fal-ai/flux-pro'
  },
  {
    id: 'escena-2',
    prompt: 'Photorealistic scene. Same woman in her 40s standing across the street from another neighborhood store. Two workers are lowering the heavy metal security curtain with clanking sounds. The woman watches from the sidewalk — hand on hip, slight head shake, resigned expression. Evening light, quiet street, faint Día de Muertos decorations on nearby walls. Cinematic framing from her perspective, slightly elevated angle. Mexico. No text in image.',
    aspectRatio: '16:9',
    model: 'fal-ai/flux-pro'
  },
  {
    id: 'escena-3',
    prompt: 'Photorealistic scene. A woman in her 40s standing at the open door of her home, sunlight streaming in, receiving a package from a young motorcycle delivery rider. The rider wears a clean uniform with "Farmacias Madero" branding, white helmet, holding a small package with the pharmacy logo visible. The woman is smiling — relieved, grateful. The motorcycle is parked on the street behind the rider, slightly blurred. Daytime, warm and bright, sense of home comfort. Mexico. Cinematic framing. No text in image.',
    aspectRatio: '16:9',
    model: 'fal-ai/flux-pro'
  }
];

async function generateScene(scene) {
  console.log(`\nGenerating ${scene.id}...`);
  console.log(`Model: ${scene.model}`);
  console.log(`Prompt: ${scene.prompt.substring(0, 80)}...`);

  try {
    const result = await fal.subscribe(scene.model, {
      input: {
        prompt: scene.prompt,
        aspect_ratio: scene.aspectRatio,
        num_images: 1
      },
      logs: true
    });

    console.log(`Result: ${JSON.stringify(result, null, 2).substring(0, 200)}...`);
    return result;
  } catch (error) {
    console.error(`Error generating ${scene.id}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting CM01 Storyboard Generation');
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`🔑 FAL_KEY: ${FAL_KEY.substring(0, 10)}...`);

  for (const scene of scenes) {
    const result = await generateScene(scene);
    if (result && result.images) {
      console.log(`✅ ${scene.id} generated: ${result.images[0]?.url || 'no url'}`);
    }
    // Rate limit protection
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);