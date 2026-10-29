import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras da rede MEL: o que pode, o que não pode e como cuidamos da comunidade.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de uso"
      intro="A MEL é uma rede de ajuda. Estas regras existem para que ela continue segura e útil para todo mundo."
    >
      <LegalSection title="1. O que é a MEL">
        <p>
          Uma plataforma gratuita para publicar pets perdidos, encontrados e avistados, colocar animais para adoção e conhecer parceiros
          que ajudam a comunidade. A MEL aproxima pessoas; não garante que um pet será encontrado.
        </p>
      </LegalSection>

      <LegalSection title="2. Sua conta">
        <ul>
          <li>Use informações verdadeiras e mantenha sua senha em segurança.</li>
          <li>Você é responsável pelo que publica e pelas conversas que inicia.</li>
          <li>
            Pode excluir sua conta quando quiser em <Link href="/perfil/privacidade" className="font-semibold text-link underline">Perfil → Privacidade e dados</Link>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. O que não é permitido">
        <ul>
          <li>Vender animais. Adoção na MEL é sempre gratuita.</li>
          <li>Pedir dinheiro, “taxa de resgate” ou recompensa antecipada para devolver um pet.</li>
          <li>Publicar alertas falsos, dados de outras pessoas ou o endereço residencial de alguém.</li>
          <li>Ofender, assediar, discriminar ou ameaçar qualquer pessoa.</li>
          <li>Usar a MEL para propaganda que não seja de um parceiro aprovado.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Moderação">
        <p>
          Qualquer pessoa pode denunciar um conteúdo. A equipe da MEL revisa denúncias, anúncios de adoção e cadastros de parceiros, e
          pode ocultar conteúdo ou suspender contas que descumpram estas regras. Toda ação de moderação fica registrada.
        </p>
      </LegalSection>

      <LegalSection title="5. Encontros e segurança">
        <p>
          Para devolver ou buscar um pet, combine em local público e movimentado, de preferência acompanhado. Desconfie de quem pede
          dinheiro ou se recusa a mostrar o animal. A MEL não participa dos encontros e não se responsabiliza por acordos entre usuários.
        </p>
      </LegalSection>

      <LegalSection title="6. Parceiros e conteúdo patrocinado">
        <p>
          Empresas parceiras passam por aprovação. Ofertas pagas ou de apoio à rede aparecem sempre com o selo “Patrocinado”. A relação
          comercial com um parceiro é entre você e a empresa.
        </p>
      </LegalSection>

      <LegalSection title="7. Seu conteúdo">
        <p>
          As fotos e textos continuam sendo seus. Ao publicar, você autoriza a MEL a exibi-los e a gerar cartazes e compartilhamentos
          para ajudar na busca, enquanto o conteúdo estiver publicado.
        </p>
      </LegalSection>

      <LegalSection title="8. Contato e mudanças">
        <p>
          Dúvidas: {CONTACT_EMAIL}. Se estes termos mudarem, avisamos no app. O uso dos seus dados está descrito na{" "}
          <Link href="/privacidade" className="font-semibold text-link underline">
            Política de privacidade
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
