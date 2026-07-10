import Link from "next/link";
import { AdminHeader } from "./AdminNav";

const overviewStats = [
  { label: "待审核充值", value: "6", note: "付款凭证待核验" },
  { label: "今日充值", value: "¥8,860", note: "人工确认到账" },
  { label: "可用积分", value: "126,480", note: "全站客户余额" },
  { label: "待处理反馈", value: "4", note: "运营收件箱" }
];

const workbenches = [
  { title: "客户与积分账户", href: "/admin/members", desc: "查看客户资料、余额、冻结积分、累计充值消耗，并支持人工调账。" },
  { title: "充值审核", href: "/admin/recharge-orders", desc: "核对付款方式、金额和截图，通过后入账，驳回时记录原因。" },
  { title: "财务流水", href: "/admin/billing", desc: "集中查看充值、扣费、冻结、释放和人工调账流水，可按用户和类型筛选。" },
  { title: "风格库后台", href: "/admin/style-library", desc: "管理通用类商品风格样本、解析状态、标签和发布到用户端的风格资产。" },
  { title: "反馈收件箱", href: "/admin/feedback-reports", desc: "处理用户提交的问题反馈，标记有效、无效或已处理，并保留备注。" }
];

const todayTasks = [
  "核对 3 笔微信收款截图与套餐金额",
  "复查 2 个异常扣费流水",
  "给 1 位企业客户补录人工调账原因",
  "关闭已解决的反馈工单"
];

export default function AdminPage() {
  return (
    <main className="adminShell">
      <AdminHeader active="overview" kicker="Admin Center" title="管理后台" />

      <section className="adminStatsGrid feedbackStatsGrid">
        {overviewStats.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <em>{item.note}</em>
          </article>
        ))}
      </section>

      <section className="adminWorkflowGrid">
        <div className="adminPanel">
          <div className="adminPanelHeader"><span>01</span><strong>后台工作台</strong></div>
          <div className="adminWorkbenchGrid">
            {workbenches.map((item) => (
              <Link href={item.href} key={item.href}>
                <strong>{item.title}</strong>
                <span>{item.desc}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="adminPanel">
          <div className="adminPanelHeader"><span>02</span><strong>今日处理清单</strong></div>
          <div className="adminExplainBox">
            <strong>运营口径</strong>
            <span>页面已按通用百货站后台的结构补齐；充值审核、积分账户、财务流水和反馈状态都写入通用站数据文件。</span>
          </div>
          <div className="adminTaskList">
            {todayTasks.map((item, index) => (
              <article key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
