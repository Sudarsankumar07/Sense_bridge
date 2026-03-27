/**
 * Platform-aware component resolver
 * - On web: Exports AvatarCanvas.web (fallback placeholder)
 * - On native (Expo): Exports AvatarCanvas.native (full 3D renderer)
 * 
 * Metro bundler handles platform resolution automatically:
 * - Removes .native files from web bundle
 * - Removes .web files from native bundle
 */

// For web platform - fallback placeholder component
export * from './AvatarCanvas.web';

// NOTE: On native platform, this will be replaced by .native variant by Metro bundler
// Re-export for platform override (Metro handles this automatically)
export { AvatarCanvas } from './AvatarCanvas.native';

