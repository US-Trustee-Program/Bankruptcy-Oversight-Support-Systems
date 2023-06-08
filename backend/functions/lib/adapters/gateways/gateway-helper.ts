import { PacerCaseData } from "../types/pacer";
import * as fs from "fs";

export class GatewayHelper {

  pacerMockExtract(): PacerCaseData[] {

    const filename = "./lib/testing/mock-data/pacer-data.mock.json";

    try {
      const data = fs.readFileSync(filename, "utf-8");
      const jsonData = JSON.parse(data);
      return jsonData.content;
    } catch (err) {
      throw Error(err);
    }
  }
}
