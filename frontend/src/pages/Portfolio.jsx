import PortfolioSimulator from "../PortfolioSimulator";
import { PROD_API_URL } from "../utils/constants";

export default function Portfolio() {
  return (
    <div className="al-page">
      <PortfolioSimulator apiBase={PROD_API_URL} onClose={null} embedded />
    </div>
  );
}
