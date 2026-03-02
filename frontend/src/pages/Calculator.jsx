import JewelleryCalculator from "../JewelleryCalculator";
import { PROD_API_URL } from "../utils/constants";

export default function Calculator() {
  return (
    <div className="al-page">
      <JewelleryCalculator apiBase={PROD_API_URL} onClose={null} embedded />
    </div>
  );
}
