export const generateRandomHash = () => crypto.randomUUID().split("-").join("");

export const hashFile = async (file: string) => {
  const fileData = await Deno.readFile(`.flair/weights/${file}.pth`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileData);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const frames = ["●   ", " ●  ", "  ● ", "   ●", "  ● ", " ●  "];

class Spinner {
  interval: null | number;
  message: string;
  constructor() {
    this.interval = null;
    this.message = "";
  }
  start(message: string) {
    this.message = message;
    let frameIndex = 0;

    this.interval = setInterval(() => {
      Deno.stdout.writeSync(
        new TextEncoder().encode(`\r${this.message} ${frames[frameIndex]}`)
      );
      frameIndex = (frameIndex + 1) % frames.length;
    }, 100);
  }
  stop() {
    clearInterval(this.interval as number);
    Deno.stdout.writeSync(new TextEncoder().encode());
    Deno.stdout.writeSync(new TextEncoder().encode(`\r${this.message} ✔\n`));
  }
}

export const spinner = new Spinner();
