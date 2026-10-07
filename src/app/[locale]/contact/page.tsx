import { createClient } from "@/lib/supabase";
import { requireAuthenticatedUser } from "@/lib/auth";
import { TabBar } from "@/components/TabBar";
import { getTranslations } from "next-intl/server";
import { ContactForm } from "./ContactForm";
import styles from "./page.module.css";

export default async function ContactPage() {
  const supabase = await createClient();
  await requireAuthenticatedUser(supabase, "/auth/login?next=/contact");

  const t = await getTranslations("Contact");

  return (
    <>
      <main className={styles.page}>
        <header className={styles.topBar}>
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
