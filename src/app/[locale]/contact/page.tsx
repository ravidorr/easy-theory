import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Link } from "@/lib/navigation";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";
import { getTranslations } from "next-intl/server";
import { ContactForm } from "./ContactForm";
import styles from "./page.module.css";

export default async function ContactPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/contact");

  const t = await getTranslations("Contact");

  return (
    <>
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/more" className={`icon-btn ${styles.closeBtn}`} aria-label={t("closeLabel")}>
            <Icon name="close" size={20} />
          </Link>
          <div className={styles.titleCol}>
            <h1>{t("pageTitle")}</h1>
            <p className={styles.subtitle}>{t("subtitle")}</p>
          </div>
        </header>

        <ContactForm />
      </main>
      <TabBar active="more" current={null} />
    </>
  );
}
