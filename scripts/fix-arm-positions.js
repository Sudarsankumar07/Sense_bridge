/**
 * fix-arm-positions.js
 * 
 * PROBLEM: All signs have RightArm x <= 0 and RightForeArm x >= 0.
 * In Mixamo GLB local space (ZYX order):
 *   RightArm X:  POSITIVE = arm tilts FORWARD (in front of body)
 *                NEGATIVE = arm tilts BACKWARD (behind body) ← the bug
 *   RightForeArm X: NEGATIVE = elbow bends TOWARD the body front (correct)
 *                   POSITIVE = elbow bends AWAY from body (wrong)
 * 
 * FIX RULES applied to every sign frame:
 *   - If RightArm x < 0.3   → set to 0.4  (bring arm in front of body)
 *   - If RightForeArm x > 0 → negate it   (bend elbow toward face, not away)
 *   - RightShoulder x       → set to 0.2  (pull shoulder slightly forward too)
 * 
 * Same mirror rules for Left arm (signs that have LeftArm data).
 */

const fs = require('fs');
const path = require('path');

const SIGNS_DIR  = path.join(__dirname, '..', 'assets', 'signs');
const ALPHA_DIR  = path.join(SIGNS_DIR, 'alphabet');

function fixBones(bones) {
    const fixed = { ...bones };

    // ── RIGHT ARM ────────────────────────────────────────────────────────────
    if (fixed.RightShoulder) {
        // Pull shoulder slightly forward so the whole chain comes front
        if ((fixed.RightShoulder.x || 0) < 0.2) {
            fixed.RightShoulder = { ...fixed.RightShoulder, x: 0.2 };
        }
    }
    if (fixed.RightArm) {
        // Arm must have positive X to be in front of body
        if ((fixed.RightArm.x || 0) < 0.4) {
            fixed.RightArm = { ...fixed.RightArm, x: 0.4 };
        }
    }
    if (fixed.RightForeArm) {
        // Forearm X > 0 pushes elbow backward; negate to bring it forward
        if ((fixed.RightForeArm.x || 0) > 0) {
            fixed.RightForeArm = { ...fixed.RightForeArm, x: -(fixed.RightForeArm.x) };
        }
    }

    // ── LEFT ARM (mirror) ────────────────────────────────────────────────────
    if (fixed.LeftShoulder) {
        if ((fixed.LeftShoulder.x || 0) < 0.2) {
            fixed.LeftShoulder = { ...fixed.LeftShoulder, x: 0.2 };
        }
    }
    if (fixed.LeftArm) {
        if ((fixed.LeftArm.x || 0) < 0.4) {
            fixed.LeftArm = { ...fixed.LeftArm, x: 0.4 };
        }
    }
    if (fixed.LeftForeArm) {
        if ((fixed.LeftForeArm.x || 0) > 0) {
            fixed.LeftForeArm = { ...fixed.LeftForeArm, x: -(fixed.LeftForeArm.x) };
        }
    }

    return fixed;
}

function fixSignFile(filePath) {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    raw.frames = raw.frames.map(frame => ({
        ...frame,
        bones: fixBones(frame.bones),
    }));

    // Append fix note to notes field
    if (raw.notes) {
        raw.notes += ' [ARM-FIXED: positive X forward, negative forearm X bends elbow toward body]';
    }

    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2));
    console.log(`✅ Fixed: ${path.basename(filePath)}`);
}

// Fix all word signs
const wordSigns = fs.readdirSync(SIGNS_DIR).filter(f => f.endsWith('.json'));
wordSigns.forEach(file => fixSignFile(path.join(SIGNS_DIR, file)));

// Fix all alphabet signs
const alphaSigns = fs.readdirSync(ALPHA_DIR).filter(f => f.endsWith('.json'));
alphaSigns.forEach(file => fixSignFile(path.join(ALPHA_DIR, file)));

console.log(`\n🎉 Done! Fixed ${wordSigns.length} word signs and ${alphaSigns.length} alphabet signs.`);
console.log('The hand will now appear in FRONT of the body (positive X on RightArm) with elbow bent correctly.');
