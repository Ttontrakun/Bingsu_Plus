// Auth Service - Main Entry Point
// Combines new (askaa_backend) and legacy (website) auth implementations

import { authRouter } from './auth.js';

// Legacy auth routes (from website) - can be imported if needed
// import { router as legacyAuthRouter } from './legacy/auth.py';

export { authRouter };
export default authRouter;
