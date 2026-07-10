import Link from "next/link";
import {
  creditChargePrinciples,
  creditChargeRules,
  creditRechargePlans,
  creditUnitPriceCny,
  detailModuleImageCreditMultiplier,
  detailPosterImageCreditMultiplier
} from "../../src/domain/billing/creditPlans";

function formatCredits(value: number): string {
  return value > 0 ? `${value} 点` : "0 点";
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: value % 1 ? 1 : 0, maximumFractionDigits: 1 }).format(value);
}

function priceForCredits(credits: number): string {
  return formatPrice(credits * creditUnitPriceCny);
}

function detailModuleCredits(baseCredits: number): number {
  return Math.ceil(baseCredits * detailModuleImageCreditMultiplier);
}

function detailPosterCredits(baseCredits: number): number {
  return Math.ceil(baseCredits * detailPosterImageCreditMultiplier);
}

const lowestImageCredits = Math.min(...creditRechargePlans.map((plan) => plan.imageCreditsPerUnit));
const highestImageCredits = Math.max(...creditRechargePlans.map((plan) => plan.imageCreditsPerUnit));
const lowestVideoCredits = Math.min(...creditRechargePlans.map((plan) => plan.videoCreditsPerUnit));
const highestVideoCredits = Math.max(...creditRechargePlans.map((plan) => plan.videoCreditsPerUnit));

export default function PricingPage() {
  const freeRules = creditChargeRules.filter((rule) => rule.credits === 0);
  const paidRules = creditChargeRules.filter((rule) => rule.credits > 0);

  return (
    <main className="rechargePage">
      <header className="rechargeHeader">
        <Link className="rechargeLogo" href="/">
          <img alt="" src="/brand-logo.svg" />
          <strong>通用百货AI创作平台</strong>
        </Link>
        <div className="billingHeaderActions">
          <Link className="rechargeBackLink" href="/recharge">返回充值</Link>
          <Link className="rechargeBackLink" href="/">返回工作台</Link>
        </div>
      </header>

      <section className="rechargeShell">
        <div className="creditHero pricingHero">
          <div>
            <span className="eyebrow">深图资费</span>
            <h1>作品生成价格与扣费规则</h1>
            <p>1 算力点按 0.10 元折算。按输出结果计费，充值档位越高，生图和视频扣点越低。</p>
          </div>
          <aside className="balanceCard" aria-label="基础扣费">
            <span>基础生图</span>
            <strong>{highestImageCredits}</strong>
            <em>散户算力点 / 张</em>
          </aside>
        </div>

        <section className="pricingRulesPanel priceRangePanel" aria-label="人民币参考价格">
          <div className="sectionHeading">
            <span className="eyebrow">参考价格</span>
            <h2>生成一个作品大约多少钱</h2>
          </div>
          <div className="priceRangeGrid">
            <article>
              <span>基础图片</span>
              <strong>{priceForCredits(lowestImageCredits)} - {priceForCredits(highestImageCredits)}</strong>
              <em>主图、白底图、场景图 / 张</em>
            </article>
            <article>
              <span>详情模块图</span>
              <strong>{priceForCredits(detailModuleCredits(lowestImageCredits))} - {priceForCredits(detailModuleCredits(highestImageCredits))}</strong>
              <em>面料、卖点、局部细节 / 张</em>
            </article>
            <article>
              <span>详情首屏海报</span>
              <strong>{priceForCredits(detailPosterCredits(lowestImageCredits))} - {priceForCredits(detailPosterCredits(highestImageCredits))}</strong>
              <em>含标题、卖点文案、排版 / 张</em>
            </article>
            <article>
              <span>短视频生成</span>
              <strong>{priceForCredits(lowestVideoCredits)} - {priceForCredits(highestVideoCredits)}</strong>
              <em>基础视频 / 条，复杂参考素材另计</em>
            </article>
          </div>
          <p className="priceRangeNote">以上按 1 算力点 = 0.10 元折算。实际扣点以用户最高已审核充值档位为准，任务失败且未进入模型生成阶段不扣点。</p>
        </section>

        <section className="pricingRulesPanel" aria-label="充值档位价格对照">
          <div className="sectionHeading">
            <span className="eyebrow">档位对照</span>
            <h2>不同充值档位的单次参考价</h2>
          </div>
          <div className="tierPriceTable">
            <div className="tierPriceHead">
              <span>充值档位</span>
              <span>用户类型</span>
              <span>基础图</span>
              <span>详情模块</span>
              <span>详情海报</span>
              <span>短视频</span>
            </div>
            {creditRechargePlans.map((plan) => (
              <article key={plan.id}>
                <strong>{formatPrice(plan.priceCny)}</strong>
                <span>{plan.customerType}</span>
                <b>{priceForCredits(plan.imageCreditsPerUnit)} / 张</b>
                <b>{priceForCredits(detailModuleCredits(plan.imageCreditsPerUnit))} / 张</b>
                <b>{priceForCredits(detailPosterCredits(plan.imageCreditsPerUnit))} / 张</b>
                <b>{priceForCredits(plan.videoCreditsPerUnit)} / 条</b>
              </article>
            ))}
          </div>
        </section>

        <section className="pricingRulesPanel" aria-label="扣费规则">
          <div className="sectionHeading">
            <span className="eyebrow">扣费表</span>
            <h2>不同类型图片怎么扣费</h2>
          </div>
          <div className="pricingTable">
            <div className="pricingTableHead">
              <span>项目</span>
              <span>适用场景</span>
              <span>扣点</span>
              <span>计算规则</span>
            </div>
            {paidRules.map((rule) => (
              <article className="pricingRuleRow" key={rule.id}>
                <strong>{rule.item}</strong>
                <span>{rule.scenario}</span>
                <b>{formatCredits(rule.credits)} / {rule.unit}</b>
                <em>{rule.formula}</em>
                <p>{rule.note}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="pricingSplitGrid">
          <section className="pricingRulesPanel">
            <div className="sectionHeading">
              <span className="eyebrow">不扣点项目</span>
              <h2>素材和配置不重复收费</h2>
            </div>
            <div className="freeRuleList">
              {freeRules.map((rule) => (
                <article key={rule.id}>
                  <strong>{rule.item}</strong>
                  <span>{rule.scenario}</span>
                  <em>{rule.formula}</em>
                  <p>{rule.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="pricingRulesPanel">
            <div className="sectionHeading">
              <span className="eyebrow">扣费原则</span>
              <h2>实际扣点的边界</h2>
            </div>
            <ol className="pricingPrinciples">
              {creditChargePrinciples.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
        </div>
      </section>
    </main>
  );
}
