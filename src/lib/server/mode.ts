// Where this copy runs.
// - local:   the owner's own computer (127.0.0.1), settings in .company-brain/
// - demo:    the hosted sample preview (Vercel default, or BRAIN_DEMO=1)
// - hosted:  the owner's private website with real data, behind sign-in and
//            an authenticator code. Opt-in with BRAIN_HOSTED=1, which should be
//            set for the Production environment only so previews stay samples.
export const hostedLive = () =>
  process.env.BRAIN_HOSTED === "1" &&
  (!!process.env.VERCEL || process.env.SITE_LOCK === "1");
