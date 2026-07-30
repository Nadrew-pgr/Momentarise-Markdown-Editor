import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const rootLicense = resolve(process.cwd(), "../../LICENSE");
const targetLicense = resolve(process.cwd(), "LICENSE");

await copyFile(rootLicense, targetLicense);
