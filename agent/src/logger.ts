/**
 * PROVUS Logger — structured terminal output
 */

const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

export const logger = {
  info: (msg: string) =>
    console.log(`${DIM}${ts()}${RESET} ${CYAN}[INFO]${RESET}   ${msg}`),

  warn: (msg: string) =>
    console.log(`${DIM}${ts()}${RESET} ${YELLOW}[WARN]${RESET}   ${msg}`),

  error: (msg: string) =>
    console.log(`${DIM}${ts()}${RESET} ${RED}[ERROR]${RESET}  ${msg}`),

  debug: (msg: string) => {
    if (process.env.DEBUG) {
      console.log(`${DIM}${ts()}${RESET} ${DIM}[DEBUG]${RESET}  ${msg}`);
    }
  },

  attest: (msg: string) =>
    console.log(`${DIM}${ts()}${RESET} ${MAGENTA}${BOLD}[ATTEST]${RESET} ${msg}`),

  signal: (msg: string) =>
    console.log(`${DIM}${ts()}${RESET} ${BLUE}${BOLD}[SIGNAL]${RESET} ${msg}`),

  success: (msg: string) =>
    console.log(`${DIM}${ts()}${RESET} ${GREEN}[✓]${RESET}     ${msg}`),

  banner: () => {
    console.log(`
${MAGENTA}${BOLD}
  ██████╗ ██████╗  ██████╗ ██╗   ██╗██╗   ██╗███████╗
  ██╔══██╗██╔══██╗██╔═══██╗██║   ██║██║   ██║██╔════╝
  ██████╔╝██████╔╝██║   ██║██║   ██║██║   ██║███████╗
  ██╔═══╝ ██╔══██╗██║   ██║╚██╗ ██╔╝██║   ██║╚════██║
  ██║     ██║  ██║╚██████╔╝ ╚████╔╝ ╚██████╔╝███████║
  ╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═══╝   ╚═════╝ ╚══════╝
${RESET}${DIM}  Verified AI Strategy Marketplace — 0G Chain${RESET}
${DIM}  Every AI trading decision. Sealed. Attested. Permanent.${RESET}
`);
  },
};
