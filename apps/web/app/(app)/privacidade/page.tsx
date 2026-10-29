import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Quais dados a MEL usa, para quê, com quem compartilha e como você exporta ou exclui tudo.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de privacidade"
      intro="A MEL existe para ajudar pets a voltarem para casa. Usamos o mínimo de dados para isso, e você controla os seus."
    >
      <LegalSection title="1. Quem somos">
        <p>
          A MEL (Movimento de Encontro e Localização) é um projeto independente que conecta tutores, vizinhos, protetores e parceiros para
          encontrar pets perdidos. Fale com a gente pelo e-mail <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-link underline">{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados que usamos">
        <ul>
          <li>
            <strong>Conta:</strong> e-mail, nome de exibição, cidade, estado e foto (opcional).
          </li>
          <li>
            <strong>Pets e alertas:</strong> fotos, descrição, características, local e data aproximados do desaparecimento ou do encontro.
          </li>
          <li>
            <strong>Avistamentos:</strong> local, horário, foto (opcional) e observações. Dá para enviar sem conta.
          </li>
          <li>
            <strong>Conversas:</strong> mensagens trocadas dentro da MEL.
          </li>
          <li>
            <strong>Guardião MEL:</strong> a área aproximada onde você quer receber alertas e o dispositivo que recebe as notificações.
          </li>
          <li>
            <strong>Segurança:</strong> denúncias, bloqueios e registros de moderação.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Sua localização">
        <p>
          Nunca mostramos o endereço da sua casa. Nos alertas públicos, o local aparece de forma aproximada. Telefone só aparece se você
          decidir mostrar. Endereços de empresas parceiras são públicos porque são estabelecimentos.
        </p>
      </LegalSection>

      <LegalSection title="4. Para que usamos">
        <ul>
          <li>Publicar alertas, avistamentos, anúncios de adoção e perfis de parceiros.</li>
          <li>Sugerir possíveis correspondências entre pets perdidos e encontrados.</li>
          <li>Avisar quem está por perto (Guardião MEL) e notificar você sobre o seu caso.</li>
          <li>Prevenir golpes e abusos, e moderar o conteúdo.</li>
        </ul>
        <p>
          A base legal é a execução do serviço que você pediu, o seu consentimento (localização e notificações) e o nosso legítimo
          interesse em manter a rede segura. Não vendemos dados e não usamos seus dados para publicidade.
        </p>
      </LegalSection>

      <LegalSection title="5. Com quem compartilhamos">
        <p>Só com serviços necessários para a MEL funcionar, que tratam os dados em nosso nome:</p>
        <ul>
          <li>Supabase (banco de dados, login e armazenamento de fotos).</li>
          <li>MapTiler e OpenStreetMap (mapas e busca de endereços).</li>
          <li>Serviços de notificação do seu navegador (Google, Apple, Microsoft ou Mozilla) quando você ativa alertas.</li>
          <li>Cloudflare Turnstile (proteção contra robôs).</li>
        </ul>
        <p>Podemos compartilhar dados com autoridades quando a lei exigir.</p>
      </LegalSection>

      <LegalSection title="6. Por quanto tempo">
        <p>
          Guardamos seus dados enquanto sua conta existir. Alertas encerrados continuam como histórico até você apagá-los ou excluir a
          conta. Registros de moderação ficam pelo tempo necessário para proteger a rede.
        </p>
      </LegalSection>

      <LegalSection title="7. Seus direitos">
        <p>
          Em <Link href="/perfil/privacidade" className="font-semibold text-link underline">Perfil → Privacidade e dados</Link> você pode
          baixar uma cópia de tudo o que guardamos e excluir sua conta de forma definitiva. Para corrigir dados, edite seu perfil, pets e
          alertas. Para qualquer outro pedido, escreva para {CONTACT_EMAIL}.
        </p>
        <p>
          Ao excluir a conta, apagamos perfil, pets, alertas, fotos, conversas, anúncios e empresas. Avistamentos que você enviou para
          ajudar outra família continuam no alerta, sem seu nome e sem foto.
        </p>
      </LegalSection>

      <LegalSection title="8. Crianças e adolescentes">
        <p>A MEL é para maiores de 18 anos. Menores podem usar com o acompanhamento de um responsável.</p>
      </LegalSection>

      <LegalSection title="9. Mudanças">
        <p>Se esta política mudar, avisamos no app e pedimos um novo aceite quando a mudança for relevante.</p>
      </LegalSection>
    </LegalPage>
  );
}
