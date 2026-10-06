/**
 * Transactional email copy, one block per platform locale (it, en, fr, de, nl, ro).
 *
 * Functions receive values that the caller has ALREADY escaped for the target
 * context (`esc()` for HTML, `line()` for subjects) — they never escape
 * themselves, so they must only ever be called from `renderAuthEmail`.
 */

export type EmailLocale = "it" | "en" | "fr" | "de" | "nl" | "ro";
export const EMAIL_LOCALES: EmailLocale[] = ["it", "en", "fr", "de", "nl", "ro"];

export type QuoteStatus = "new" | "contacted" | "quoted" | "won" | "lost" | "spam";

export interface EmailStrings {
  tagline: string;
  verify: { subject: string; title: string; body: string; expires: string; textLabel: string };
  reset: { subject: string; title: string; body: string; expires: string; textLabel: string };
  welcome: { subject: string; title: string; body: (company: string) => string; cta: string };
  newQuote: {
    subject: (lead: string) => string;
    title: string;
    lead: string;
    lockedQuota: string;
    lockedSuspended: string;
    configurator: string;
    value: string;
    cta: string;
    textLocked: string;
  };
  statusChanged: {
    subject: (lead: string, status: string) => string;
    title: string;
    lead: string;
    cta: string;
    statuses: Record<QuoteStatus, string>;
  };
  memberJoined: { subject: (name: string) => string; title: string; body: (name: string) => string; cta: string };
  published: {
    subject: (name: string, version: string) => string;
    title: string;
    configurator: string;
    version: string;
    cta: string;
  };
  planLimit: {
    subject: string;
    title: string;
    locked: (limit: string) => string;
    unlocked: (limit: string) => string;
    cta: string;
  };
  system: { subject: string; title: string; open: string };
  invitation: {
    subject: (company: string) => string;
    title: string;
    body: (inviter: string, company: string, role: string) => string;
    colleague: string;
    company: string;
    roles: { admin: string; member: string };
    cta: string;
    expires: string;
    text: string;
  };
  teamAccess: {
    invite: { subject: (company: string) => string; title: string; body: (inviter: string, company: string, team: string, grade: string) => string };
    login: { subject: (company: string) => string; title: string; body: (company: string, team: string) => string };
    colleague: string;
    company: string;
    codeLabel: string;
    cta: string;
    howTo: string;
    expires7: string;
    expires15: string;
    neverShare: string;
    text: string;
  };
  referral: {
    invited: { subject: string; title: string; body: (percent: string) => string; cta: string };
    registered: { subject: string; title: string; body: string; cta: string };
    rewarded: { subject: (amount: string) => string; title: string; body: (amount: string) => string; cta: string };
    /** Reward paid as money to the inviter's Stripe account. */
    paid: { subject: (amount: string) => string; title: string; body: (amount: string) => string; cta: string };
  };
  notification: string;
}

const it: EmailStrings = {
  tagline: "onespec — configuratore infissi",
  verify: {
    subject: "Il tuo codice di verifica — onespec",
    title: "Verifica il tuo indirizzo email",
    body: "Inserisci questo codice per completare la registrazione:",
    expires: "Il codice scade tra 15 minuti. Se non hai richiesto la registrazione, ignora questa email.",
    textLabel: "Codice di verifica",
  },
  reset: {
    subject: "Reimposta la password — onespec",
    title: "Reimposta la password",
    body: "Codice per reimpostare la password:",
    expires: "Scade tra 15 minuti. Se non hai richiesto il reset, ignora questa email.",
    textLabel: "Codice reset password",
  },
  welcome: {
    subject: "Benvenuto in onespec",
    title: "Benvenuto in onespec",
    body: (c) => `<strong>${c}</strong> è registrata. Crea il tuo primo configuratore.`,
    cta: "Vai alla dashboard",
  },
  newQuote: {
    subject: (l) => `Nuova richiesta preventivo: ${l}`,
    title: "Nuova richiesta preventivo",
    lead: "Cliente",
    lockedQuota: "limite mensile raggiunto — i contatti si sbloccano passando a un piano superiore o dal primo del mese",
    lockedSuspended: "abbonamento sospeso — i contatti si sbloccano riattivando l'abbonamento",
    configurator: "Configuratore",
    value: "Valore",
    cta: "Apri in dashboard",
    textLocked: "Nuova richiesta preventivo (contatti bloccati)",
  },
  statusChanged: {
    subject: (l, s) => `Preventivo aggiornato: ${l} → ${s}`,
    title: "Preventivo aggiornato",
    lead: "Cliente",
    cta: "Apri in dashboard",
    statuses: { new: "Nuova", contacted: "Contattato", quoted: "Preventivo inviato", won: "Vinta", lost: "Persa", spam: "Spam" },
  },
  memberJoined: {
    subject: (n) => `Nuovo membro nel team: ${n}`,
    title: "Nuovo membro nel team",
    body: (n) => `<strong>${n}</strong> è entrato a far parte del team.`,
    cta: "Vai al team",
  },
  published: {
    subject: (n, v) => `Configuratore pubblicato: ${n} v${v}`,
    title: "Configuratore pubblicato",
    configurator: "Configuratore",
    version: "versione",
    cta: "Apri configuratore",
  },
  planLimit: {
    subject: "Limite del piano raggiunto — onespec",
    title: "Limite del piano",
    locked: (l) =>
      `Limite mensile raggiunto (${l} richieste). Le nuove richieste vengono salvate, ma i contatti restano nascosti finché non passi a un piano superiore o fino al primo del mese.`,
    unlocked: (l) =>
      `Limite mensile raggiunto (${l} richieste). Le nuove richieste vengono comunque salvate: passa a un piano superiore per alzare il limite.`,
    cta: "Gestisci piano",
  },
  system: { subject: "Notifica — onespec", title: "Notifica", open: "Apri" },
  invitation: {
    subject: (c) => `Invito a collaborare su onespec — ${c}`,
    title: "Invito a collaborare",
    body: (i, c, r) => `${i} ti ha invitato a lavorare su <strong>${c}</strong> in onespec come <strong>${r}</strong>.`,
    colleague: "Un collega",
    company: "un'azienda",
    roles: { admin: "amministratore", member: "membro" },
    cta: "Accetta l'invito",
    expires: "L'invito scade tra 7 giorni.",
    text: "Sei stato invitato a onespec",
  },
  teamAccess: {
    invite: {
      subject: (c) => `Il tuo accesso a ${c} su onespec`,
      title: "Sei stato invitato nel team",
      body: (i, c, t, g) => `${i} ti ha invitato a entrare in <strong>${c}</strong> (gruppo <strong>${t}</strong>) come <strong>${g}</strong>.`,
    },
    login: {
      subject: (c) => `Il tuo codice di accesso a ${c}`,
      title: "Accedi al tuo team",
      body: (c, t) => `Hai chiesto di accedere a <strong>${c}</strong> (gruppo <strong>${t}</strong>).`,
    },
    colleague: "Un collega",
    company: "un'azienda",
    codeLabel: "Il tuo codice di verifica",
    cta: "Apri la pagina di accesso",
    howTo: "Per entrare servono tre cose: questo link, il codice qui sopra e la password del gruppo, che ti dà di persona chi ti ha invitato. La password non è scritta in questa email.",
    expires7: "Il link e il codice scadono tra 7 giorni e si usano una sola volta.",
    expires15: "Il link e il codice scadono tra 15 minuti e si usano una sola volta.",
    neverShare: "Non inoltrare questa email: chi ha link e codice, conoscendo la password del gruppo, può entrare al tuo posto.",
    text: "Accesso al team su onespec",
  },
  referral: {
    invited: {
      subject: "Il tuo sconto invito — onespec",
      title: "Hai uno sconto sul primo pagamento",
      body: (p) => `Ti sei registrato con l'invito di un'altra azienda: avrai il ${p}% di sconto sul primo pagamento, applicato in automatico quando scegli il piano.`,
      cta: "Scegli il piano",
    },
    registered: {
      subject: "Un'azienda si è registrata con il tuo invito — onespec",
      title: "Il tuo invito ha funzionato",
      body: "Una nuova azienda si è registrata con il tuo codice. Quando farà il primo pagamento e saranno trascorsi 30 giorni senza rimborsi, riceverai il tuo credito sull'abbonamento.",
      cta: "Vedi i tuoi inviti",
    },
    rewarded: {
      subject: (a) => `Hai ricevuto ${a} di credito — onespec`,
      title: "Credito invito accreditato",
      body: (a) => `Abbiamo aggiunto ${a} di credito al tuo account: verrà scalato dalle prossime fatture dell'abbonamento. Grazie per aver portato un nuovo cliente.`,
      cta: "Vedi i tuoi inviti",
    },
    paid: {
      subject: (a) => `Ti abbiamo inviato ${a} — onespec`,
      title: "Premio invito pagato",
      body: (a) => `Abbiamo trasferito ${a} sul tuo conto Stripe collegato: lo vedrai tra i tuoi pagamenti Stripe nei prossimi giorni. Grazie per aver portato un nuovo cliente.`,
      cta: "Vedi i tuoi inviti",
    },
  },
  notification: "Notifica",
};

const en: EmailStrings = {
  tagline: "onespec — window & door configurator",
  verify: {
    subject: "Your verification code — onespec",
    title: "Verify your email address",
    body: "Enter this code to complete your registration:",
    expires: "The code expires in 15 minutes. If you didn't sign up, ignore this email.",
    textLabel: "Verification code",
  },
  reset: {
    subject: "Reset your password — onespec",
    title: "Reset your password",
    body: "Password reset code:",
    expires: "Expires in 15 minutes. If you didn't request this, ignore this email.",
    textLabel: "Password reset code",
  },
  welcome: {
    subject: "Welcome to onespec",
    title: "Welcome to onespec",
    body: (c) => `<strong>${c}</strong> is registered. Create your first configurator.`,
    cta: "Go to dashboard",
  },
  newQuote: {
    subject: (l) => `New quote request: ${l}`,
    title: "New quote request",
    lead: "Lead",
    lockedQuota: "monthly limit reached — contact details unlock when you upgrade or on the 1st of next month",
    lockedSuspended: "subscription suspended — contact details unlock when you reactivate your subscription",
    configurator: "Configurator",
    value: "Value",
    cta: "Open in dashboard",
    textLocked: "New quote request (contact details locked)",
  },
  statusChanged: {
    subject: (l, s) => `Quote updated: ${l} → ${s}`,
    title: "Quote updated",
    lead: "Lead",
    cta: "Open in dashboard",
    statuses: { new: "New", contacted: "Contacted", quoted: "Quote sent", won: "Won", lost: "Lost", spam: "Spam" },
  },
  memberJoined: {
    subject: (n) => `New team member: ${n}`,
    title: "New team member",
    body: (n) => `<strong>${n}</strong> has joined the team.`,
    cta: "Go to team",
  },
  published: {
    subject: (n, v) => `Configurator published: ${n} v${v}`,
    title: "Configurator published",
    configurator: "Configurator",
    version: "version",
    cta: "Open configurator",
  },
  planLimit: {
    subject: "Plan limit reached — onespec",
    title: "Plan limit",
    locked: (l) =>
      `Monthly limit reached (${l} requests). New requests are still saved, but contact details stay hidden until you upgrade or until the 1st of next month.`,
    unlocked: (l) =>
      `Monthly limit reached (${l} requests). New requests are still saved — upgrade to raise the limit.`,
    cta: "Manage plan",
  },
  system: { subject: "Notification — onespec", title: "Notification", open: "Open" },
  invitation: {
    subject: (c) => `You've been invited to onespec — ${c}`,
    title: "Team invitation",
    body: (i, c, r) => `${i} invited you to work on <strong>${c}</strong> in onespec as <strong>${r}</strong>.`,
    colleague: "A colleague",
    company: "a company",
    roles: { admin: "administrator", member: "member" },
    cta: "Accept invitation",
    expires: "This invitation expires in 7 days.",
    text: "You've been invited to onespec",
  },
  teamAccess: {
    invite: {
      subject: (c) => `Your access to ${c} on onespec`,
      title: "You have been invited to the team",
      body: (i, c, t, g) => `${i} invited you to join <strong>${c}</strong> (group <strong>${t}</strong>) as <strong>${g}</strong>.`,
    },
    login: {
      subject: (c) => `Your access code for ${c}`,
      title: "Sign in to your team",
      body: (c, t) => `You asked to sign in to <strong>${c}</strong> (group <strong>${t}</strong>).`,
    },
    colleague: "A colleague",
    company: "a company",
    codeLabel: "Your verification code",
    cta: "Open the sign-in page",
    howTo: "To get in you need three things: this link, the code above and the group password, which the person who invited you gives you in person. The password is not written in this e-mail.",
    expires7: "The link and the code expire in 7 days and can be used only once.",
    expires15: "The link and the code expire in 15 minutes and can be used only once.",
    neverShare: "Do not forward this e-mail: anyone with the link and the code who also knows the group password can come in as you.",
    text: "Team access on onespec",
  },
  referral: {
    invited: {
      subject: "Your invitation discount — onespec",
      title: "You have a discount on your first payment",
      body: (p) => `You signed up through another company's invitation: you get ${p}% off your first payment, applied automatically when you choose your plan.`,
      cta: "Choose your plan",
    },
    registered: {
      subject: "A company signed up with your invitation — onespec",
      title: "Your invitation worked",
      body: "A new company signed up with your code. Once it makes its first payment and 30 days pass without refunds, you will receive your subscription credit.",
      cta: "See your invitations",
    },
    rewarded: {
      subject: (a) => `You received ${a} of credit — onespec`,
      title: "Invitation credit added",
      body: (a) => `We added ${a} of credit to your account: it will be deducted from your next subscription invoices. Thank you for bringing in a new customer.`,
      cta: "See your invitations",
    },
    paid: {
      subject: (a) => `We sent you ${a} — onespec`,
      title: "Invitation reward paid",
      body: (a) => `We transferred ${a} to your connected Stripe account: you will see it among your Stripe payouts in the next few days. Thank you for bringing in a new customer.`,
      cta: "See your invitations",
    },
  },
  notification: "Notification",
};

const fr: EmailStrings = {
  tagline: "onespec — configurateur de menuiseries",
  verify: {
    subject: "Votre code de vérification — onespec",
    title: "Vérifiez votre adresse e-mail",
    body: "Saisissez ce code pour finaliser votre inscription :",
    expires: "Le code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.",
    textLabel: "Code de vérification",
  },
  reset: {
    subject: "Réinitialisez votre mot de passe — onespec",
    title: "Réinitialisez votre mot de passe",
    body: "Code de réinitialisation du mot de passe :",
    expires: "Expire dans 15 minutes. Si vous n'avez rien demandé, ignorez cet e-mail.",
    textLabel: "Code de réinitialisation",
  },
  welcome: {
    subject: "Bienvenue sur onespec",
    title: "Bienvenue sur onespec",
    body: (c) => `<strong>${c}</strong> est inscrite. Créez votre premier configurateur.`,
    cta: "Accéder au tableau de bord",
  },
  newQuote: {
    subject: (l) => `Nouvelle demande de devis : ${l}`,
    title: "Nouvelle demande de devis",
    lead: "Client",
    lockedQuota: "limite mensuelle atteinte — les coordonnées se débloquent en passant à une offre supérieure ou au 1er du mois",
    lockedSuspended: "abonnement suspendu — les coordonnées se débloquent en réactivant l'abonnement",
    configurator: "Configurateur",
    value: "Montant",
    cta: "Ouvrir dans le tableau de bord",
    textLocked: "Nouvelle demande de devis (coordonnées masquées)",
  },
  statusChanged: {
    subject: (l, s) => `Devis mis à jour : ${l} → ${s}`,
    title: "Devis mis à jour",
    lead: "Client",
    cta: "Ouvrir dans le tableau de bord",
    statuses: { new: "Nouvelle", contacted: "Contacté", quoted: "Devis envoyé", won: "Gagnée", lost: "Perdue", spam: "Spam" },
  },
  memberJoined: {
    subject: (n) => `Nouveau membre dans l'équipe : ${n}`,
    title: "Nouveau membre dans l'équipe",
    body: (n) => `<strong>${n}</strong> a rejoint l'équipe.`,
    cta: "Voir l'équipe",
  },
  published: {
    subject: (n, v) => `Configurateur publié : ${n} v${v}`,
    title: "Configurateur publié",
    configurator: "Configurateur",
    version: "version",
    cta: "Ouvrir le configurateur",
  },
  planLimit: {
    subject: "Limite de l'offre atteinte — onespec",
    title: "Limite de l'offre",
    locked: (l) =>
      `Limite mensuelle atteinte (${l} demandes). Les nouvelles demandes sont enregistrées, mais les coordonnées restent masquées jusqu'au passage à une offre supérieure ou jusqu'au 1er du mois.`,
    unlocked: (l) =>
      `Limite mensuelle atteinte (${l} demandes). Les nouvelles demandes sont toujours enregistrées — passez à une offre supérieure pour augmenter la limite.`,
    cta: "Gérer l'offre",
  },
  system: { subject: "Notification — onespec", title: "Notification", open: "Ouvrir" },
  invitation: {
    subject: (c) => `Invitation à rejoindre onespec — ${c}`,
    title: "Invitation à collaborer",
    body: (i, c, r) => `${i} vous invite à travailler sur <strong>${c}</strong> dans onespec en tant que <strong>${r}</strong>.`,
    colleague: "Un collègue",
    company: "une entreprise",
    roles: { admin: "administrateur", member: "membre" },
    cta: "Accepter l'invitation",
    expires: "Cette invitation expire dans 7 jours.",
    text: "Vous êtes invité sur onespec",
  },
  teamAccess: {
    invite: {
      subject: (c) => `Votre accès à ${c} sur onespec`,
      title: "Vous êtes invité dans l'équipe",
      body: (i, c, t, g) => `${i} vous invite à rejoindre <strong>${c}</strong> (groupe <strong>${t}</strong>) en tant que <strong>${g}</strong>.`,
    },
    login: {
      subject: (c) => `Votre code d'accès à ${c}`,
      title: "Connectez-vous à votre équipe",
      body: (c, t) => `Vous avez demandé à vous connecter à <strong>${c}</strong> (groupe <strong>${t}</strong>).`,
    },
    colleague: "Un collègue",
    company: "une entreprise",
    codeLabel: "Votre code de vérification",
    cta: "Ouvrir la page de connexion",
    howTo: "Pour entrer, il faut trois choses : ce lien, le code ci-dessus et le mot de passe du groupe, que la personne qui vous a invité vous donne en main propre. Le mot de passe n'est pas écrit dans cet e-mail.",
    expires7: "Le lien et le code expirent dans 7 jours et ne servent qu'une seule fois.",
    expires15: "Le lien et le code expirent dans 15 minutes et ne servent qu'une seule fois.",
    neverShare: "Ne transférez pas cet e-mail : quiconque a le lien et le code et connaît le mot de passe du groupe peut entrer à votre place.",
    text: "Accès à l'équipe sur onespec",
  },
  referral: {
    invited: {
      subject: "Votre remise d'invitation — onespec",
      title: "Vous avez une remise sur votre premier paiement",
      body: (p) => `Vous vous êtes inscrit grâce à l'invitation d'une autre entreprise : vous bénéficiez de ${p} % de remise sur votre premier paiement, appliquée automatiquement lors du choix de votre offre.`,
      cta: "Choisir mon offre",
    },
    registered: {
      subject: "Une entreprise s'est inscrite avec votre invitation — onespec",
      title: "Votre invitation a fonctionné",
      body: "Une nouvelle entreprise s'est inscrite avec votre code. Dès son premier paiement, et après 30 jours sans remboursement, vous recevrez votre crédit sur l'abonnement.",
      cta: "Voir mes invitations",
    },
    rewarded: {
      subject: (a) => `Vous avez reçu ${a} de crédit — onespec`,
      title: "Crédit d'invitation ajouté",
      body: (a) => `Nous avons ajouté ${a} de crédit à votre compte : il sera déduit de vos prochaines factures d'abonnement. Merci d'avoir amené un nouveau client.`,
      cta: "Voir mes invitations",
    },
    paid: {
      subject: (a) => `Nous vous avons envoyé ${a} — onespec`,
      title: "Récompense d'invitation versée",
      body: (a) => `Nous avons transféré ${a} sur votre compte Stripe connecté : vous le verrez parmi vos versements Stripe dans les prochains jours. Merci d'avoir amené un nouveau client.`,
      cta: "Voir mes invitations",
    },
  },
  notification: "Notification",
};

const de: EmailStrings = {
  tagline: "onespec — Fenster- und Türkonfigurator",
  verify: {
    subject: "Ihr Bestätigungscode — onespec",
    title: "Bestätigen Sie Ihre E-Mail-Adresse",
    body: "Geben Sie diesen Code ein, um Ihre Registrierung abzuschließen:",
    expires: "Der Code läuft in 15 Minuten ab. Wenn Sie sich nicht registriert haben, ignorieren Sie diese E-Mail.",
    textLabel: "Bestätigungscode",
  },
  reset: {
    subject: "Passwort zurücksetzen — onespec",
    title: "Passwort zurücksetzen",
    body: "Code zum Zurücksetzen des Passworts:",
    expires: "Läuft in 15 Minuten ab. Wenn Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail.",
    textLabel: "Code zum Zurücksetzen",
  },
  welcome: {
    subject: "Willkommen bei onespec",
    title: "Willkommen bei onespec",
    body: (c) => `<strong>${c}</strong> ist registriert. Erstellen Sie Ihren ersten Konfigurator.`,
    cta: "Zum Dashboard",
  },
  newQuote: {
    subject: (l) => `Neue Angebotsanfrage: ${l}`,
    title: "Neue Angebotsanfrage",
    lead: "Kunde",
    lockedQuota: "Monatslimit erreicht — die Kontaktdaten werden nach einem Upgrade oder ab dem 1. des Folgemonats freigegeben",
    lockedSuspended: "Abonnement pausiert — die Kontaktdaten werden nach Reaktivierung des Abonnements freigegeben",
    configurator: "Konfigurator",
    value: "Wert",
    cta: "Im Dashboard öffnen",
    textLocked: "Neue Angebotsanfrage (Kontaktdaten gesperrt)",
  },
  statusChanged: {
    subject: (l, s) => `Angebot aktualisiert: ${l} → ${s}`,
    title: "Angebot aktualisiert",
    lead: "Kunde",
    cta: "Im Dashboard öffnen",
    statuses: { new: "Neu", contacted: "Kontaktiert", quoted: "Angebot gesendet", won: "Gewonnen", lost: "Verloren", spam: "Spam" },
  },
  memberJoined: {
    subject: (n) => `Neues Teammitglied: ${n}`,
    title: "Neues Teammitglied",
    body: (n) => `<strong>${n}</strong> ist dem Team beigetreten.`,
    cta: "Zum Team",
  },
  published: {
    subject: (n, v) => `Konfigurator veröffentlicht: ${n} v${v}`,
    title: "Konfigurator veröffentlicht",
    configurator: "Konfigurator",
    version: "Version",
    cta: "Konfigurator öffnen",
  },
  planLimit: {
    subject: "Tariflimit erreicht — onespec",
    title: "Tariflimit",
    locked: (l) =>
      `Monatslimit erreicht (${l} Anfragen). Neue Anfragen werden gespeichert, die Kontaktdaten bleiben jedoch bis zu einem Upgrade oder bis zum 1. des Folgemonats verborgen.`,
    unlocked: (l) =>
      `Monatslimit erreicht (${l} Anfragen). Neue Anfragen werden weiterhin gespeichert — wechseln Sie in einen höheren Tarif, um das Limit zu erhöhen.`,
    cta: "Tarif verwalten",
  },
  system: { subject: "Benachrichtigung — onespec", title: "Benachrichtigung", open: "Öffnen" },
  invitation: {
    subject: (c) => `Einladung zu onespec — ${c}`,
    title: "Einladung zur Zusammenarbeit",
    body: (i, c, r) => `${i} hat Sie eingeladen, in onespec für <strong>${c}</strong> als <strong>${r}</strong> zu arbeiten.`,
    colleague: "Ein Kollege",
    company: "ein Unternehmen",
    roles: { admin: "Administrator", member: "Mitglied" },
    cta: "Einladung annehmen",
    expires: "Diese Einladung läuft in 7 Tagen ab.",
    text: "Sie wurden zu onespec eingeladen",
  },
  teamAccess: {
    invite: {
      subject: (c) => `Ihr Zugang zu ${c} auf onespec`,
      title: "Sie wurden ins Team eingeladen",
      body: (i, c, t, g) => `${i} hat Sie eingeladen, <strong>${c}</strong> (Gruppe <strong>${t}</strong>) als <strong>${g}</strong> beizutreten.`,
    },
    login: {
      subject: (c) => `Ihr Zugangscode für ${c}`,
      title: "Bei Ihrem Team anmelden",
      body: (c, t) => `Sie möchten sich bei <strong>${c}</strong> (Gruppe <strong>${t}</strong>) anmelden.`,
    },
    colleague: "Ein Kollege",
    company: "ein Unternehmen",
    codeLabel: "Ihr Bestätigungscode",
    cta: "Anmeldeseite öffnen",
    howTo: "Zum Eintritt brauchen Sie drei Dinge: diesen Link, den Code oben und das Gruppenpasswort, das Ihnen die einladende Person persönlich gibt. Das Passwort steht nicht in dieser E-Mail.",
    expires7: "Link und Code verfallen in 7 Tagen und sind nur einmal verwendbar.",
    expires15: "Link und Code verfallen in 15 Minuten und sind nur einmal verwendbar.",
    neverShare: "Leiten Sie diese E-Mail nicht weiter: Wer Link und Code hat und das Gruppenpasswort kennt, kann an Ihrer Stelle eintreten.",
    text: "Teamzugang auf onespec",
  },
  referral: {
    invited: {
      subject: "Ihr Einladungsrabatt — onespec",
      title: "Sie erhalten einen Rabatt auf die erste Zahlung",
      body: (p) => `Sie haben sich über die Einladung eines anderen Unternehmens registriert: Sie erhalten ${p} % Rabatt auf Ihre erste Zahlung, automatisch angewendet, sobald Sie Ihren Tarif wählen.`,
      cta: "Tarif wählen",
    },
    registered: {
      subject: "Ein Unternehmen hat sich mit Ihrer Einladung registriert — onespec",
      title: "Ihre Einladung hat funktioniert",
      body: "Ein neues Unternehmen hat sich mit Ihrem Code registriert. Nach der ersten Zahlung und 30 Tagen ohne Rückerstattung erhalten Sie Ihr Guthaben auf das Abonnement.",
      cta: "Meine Einladungen ansehen",
    },
    rewarded: {
      subject: (a) => `Sie haben ${a} Guthaben erhalten — onespec`,
      title: "Einladungsguthaben gutgeschrieben",
      body: (a) => `Wir haben Ihrem Konto ${a} Guthaben gutgeschrieben: Es wird von Ihren nächsten Abonnement-Rechnungen abgezogen. Danke, dass Sie einen neuen Kunden gewonnen haben.`,
      cta: "Meine Einladungen ansehen",
    },
    paid: {
      subject: (a) => `Wir haben Ihnen ${a} gesendet — onespec`,
      title: "Einladungsprämie ausgezahlt",
      body: (a) => `Wir haben ${a} auf Ihr verbundenes Stripe-Konto überwiesen: Sie sehen den Betrag in den nächsten Tagen unter Ihren Stripe-Auszahlungen. Danke, dass Sie einen neuen Kunden gewonnen haben.`,
      cta: "Meine Einladungen ansehen",
    },
  },
  notification: "Benachrichtigung",
};

const nl: EmailStrings = {
  tagline: "onespec — configurator voor ramen en deuren",
  verify: {
    subject: "Je verificatiecode — onespec",
    title: "Bevestig je e-mailadres",
    body: "Voer deze code in om je registratie af te ronden:",
    expires: "De code verloopt over 15 minuten. Heb je je niet geregistreerd? Negeer dan deze e-mail.",
    textLabel: "Verificatiecode",
  },
  reset: {
    subject: "Wachtwoord opnieuw instellen — onespec",
    title: "Wachtwoord opnieuw instellen",
    body: "Code om je wachtwoord opnieuw in te stellen:",
    expires: "Verloopt over 15 minuten. Heb je dit niet aangevraagd? Negeer dan deze e-mail.",
    textLabel: "Resetcode",
  },
  welcome: {
    subject: "Welkom bij onespec",
    title: "Welkom bij onespec",
    body: (c) => `<strong>${c}</strong> is geregistreerd. Maak je eerste configurator aan.`,
    cta: "Naar het dashboard",
  },
  newQuote: {
    subject: (l) => `Nieuwe offerteaanvraag: ${l}`,
    title: "Nieuwe offerteaanvraag",
    lead: "Klant",
    lockedQuota: "maandlimiet bereikt — de contactgegevens worden zichtbaar na een upgrade of vanaf de 1e van de volgende maand",
    lockedSuspended: "abonnement opgeschort — de contactgegevens worden zichtbaar zodra je het abonnement heractiveert",
    configurator: "Configurator",
    value: "Waarde",
    cta: "Openen in dashboard",
    textLocked: "Nieuwe offerteaanvraag (contactgegevens afgeschermd)",
  },
  statusChanged: {
    subject: (l, s) => `Offerte bijgewerkt: ${l} → ${s}`,
    title: "Offerte bijgewerkt",
    lead: "Klant",
    cta: "Openen in dashboard",
    statuses: { new: "Nieuw", contacted: "Gecontacteerd", quoted: "Offerte verstuurd", won: "Gewonnen", lost: "Verloren", spam: "Spam" },
  },
  memberJoined: {
    subject: (n) => `Nieuw teamlid: ${n}`,
    title: "Nieuw teamlid",
    body: (n) => `<strong>${n}</strong> is lid geworden van het team.`,
    cta: "Naar het team",
  },
  published: {
    subject: (n, v) => `Configurator gepubliceerd: ${n} v${v}`,
    title: "Configurator gepubliceerd",
    configurator: "Configurator",
    version: "versie",
    cta: "Configurator openen",
  },
  planLimit: {
    subject: "Abonnementslimiet bereikt — onespec",
    title: "Abonnementslimiet",
    locked: (l) =>
      `Maandlimiet bereikt (${l} aanvragen). Nieuwe aanvragen worden opgeslagen, maar de contactgegevens blijven afgeschermd tot je upgradet of tot de 1e van de volgende maand.`,
    unlocked: (l) =>
      `Maandlimiet bereikt (${l} aanvragen). Nieuwe aanvragen worden nog steeds opgeslagen — upgrade om de limiet te verhogen.`,
    cta: "Abonnement beheren",
  },
  system: { subject: "Melding — onespec", title: "Melding", open: "Openen" },
  invitation: {
    subject: (c) => `Uitnodiging voor onespec — ${c}`,
    title: "Uitnodiging om samen te werken",
    body: (i, c, r) => `${i} heeft je uitgenodigd om in onespec te werken voor <strong>${c}</strong> als <strong>${r}</strong>.`,
    colleague: "Een collega",
    company: "een bedrijf",
    roles: { admin: "beheerder", member: "lid" },
    cta: "Uitnodiging accepteren",
    expires: "Deze uitnodiging verloopt over 7 dagen.",
    text: "Je bent uitgenodigd voor onespec",
  },
  teamAccess: {
    invite: {
      subject: (c) => `Je toegang tot ${c} op onespec`,
      title: "Je bent uitgenodigd voor het team",
      body: (i, c, t, g) => `${i} nodigt je uit om <strong>${c}</strong> (groep <strong>${t}</strong>) te vervoegen als <strong>${g}</strong>.`,
    },
    login: {
      subject: (c) => `Je toegangscode voor ${c}`,
      title: "Meld je aan bij je team",
      body: (c, t) => `Je vroeg om aan te melden bij <strong>${c}</strong> (groep <strong>${t}</strong>).`,
    },
    colleague: "Een collega",
    company: "een bedrijf",
    codeLabel: "Je verificatiecode",
    cta: "Open de aanmeldpagina",
    howTo: "Om binnen te komen heb je drie dingen nodig: deze link, de code hierboven en het groepswachtwoord, dat de persoon die je uitnodigde je persoonlijk geeft. Het wachtwoord staat niet in deze e-mail.",
    expires7: "De link en de code verlopen over 7 dagen en kunnen maar één keer worden gebruikt.",
    expires15: "De link en de code verlopen over 15 minuten en kunnen maar één keer worden gebruikt.",
    neverShare: "Stuur deze e-mail niet door: wie de link en de code heeft en het groepswachtwoord kent, kan in jouw plaats binnenkomen.",
    text: "Teamtoegang op onespec",
  },
  referral: {
    invited: {
      subject: "Je uitnodigingskorting — onespec",
      title: "Je hebt korting op je eerste betaling",
      body: (p) => `Je hebt je aangemeld via de uitnodiging van een ander bedrijf: je krijgt ${p}% korting op je eerste betaling, automatisch toegepast zodra je je abonnement kiest.`,
      cta: "Kies je abonnement",
    },
    registered: {
      subject: "Een bedrijf heeft zich aangemeld met jouw uitnodiging — onespec",
      title: "Je uitnodiging werkt",
      body: "Een nieuw bedrijf heeft zich aangemeld met jouw code. Na de eerste betaling en 30 dagen zonder terugbetaling ontvang je je tegoed op het abonnement.",
      cta: "Bekijk je uitnodigingen",
    },
    rewarded: {
      subject: (a) => `Je hebt ${a} tegoed ontvangen — onespec`,
      title: "Uitnodigingstegoed bijgeschreven",
      body: (a) => `We hebben ${a} tegoed aan je account toegevoegd: het wordt van je volgende abonnementsfacturen afgetrokken. Bedankt voor het aanbrengen van een nieuwe klant.`,
      cta: "Bekijk je uitnodigingen",
    },
    paid: {
      subject: (a) => `We hebben je ${a} gestuurd — onespec`,
      title: "Uitnodigingsbeloning uitbetaald",
      body: (a) => `We hebben ${a} overgemaakt naar je gekoppelde Stripe-account: je ziet het de komende dagen tussen je Stripe-uitbetalingen. Bedankt voor het aanbrengen van een nieuwe klant.`,
      cta: "Bekijk je uitnodigingen",
    },
  },
  notification: "Melding",
};

const ro: EmailStrings = {
  tagline: "onespec — configurator de tâmplărie",
  verify: {
    subject: "Codul tău de verificare — onespec",
    title: "Verifică adresa de e-mail",
    body: "Introdu acest cod pentru a finaliza înregistrarea:",
    expires: "Codul expiră în 15 minute. Dacă nu te-ai înregistrat, ignoră acest e-mail.",
    textLabel: "Cod de verificare",
  },
  reset: {
    subject: "Resetează parola — onespec",
    title: "Resetează parola",
    body: "Codul pentru resetarea parolei:",
    expires: "Expiră în 15 minute. Dacă nu ai cerut resetarea, ignoră acest e-mail.",
    textLabel: "Cod de resetare",
  },
  welcome: {
    subject: "Bun venit în onespec",
    title: "Bun venit în onespec",
    body: (c) => `<strong>${c}</strong> este înregistrată. Creează primul tău configurator.`,
    cta: "Mergi la panou",
  },
  newQuote: {
    subject: (l) => `Cerere nouă de ofertă: ${l}`,
    title: "Cerere nouă de ofertă",
    lead: "Client",
    lockedQuota: "limita lunară a fost atinsă — datele de contact se deblochează la trecerea pe un plan superior sau de la 1 ale lunii",
    lockedSuspended: "abonament suspendat — datele de contact se deblochează la reactivarea abonamentului",
    configurator: "Configurator",
    value: "Valoare",
    cta: "Deschide în panou",
    textLocked: "Cerere nouă de ofertă (date de contact blocate)",
  },
  statusChanged: {
    subject: (l, s) => `Ofertă actualizată: ${l} → ${s}`,
    title: "Ofertă actualizată",
    lead: "Client",
    cta: "Deschide în panou",
    statuses: { new: "Nouă", contacted: "Contactat", quoted: "Ofertă trimisă", won: "Câștigată", lost: "Pierdută", spam: "Spam" },
  },
  memberJoined: {
    subject: (n) => `Membru nou în echipă: ${n}`,
    title: "Membru nou în echipă",
    body: (n) => `<strong>${n}</strong> s-a alăturat echipei.`,
    cta: "Mergi la echipă",
  },
  published: {
    subject: (n, v) => `Configurator publicat: ${n} v${v}`,
    title: "Configurator publicat",
    configurator: "Configurator",
    version: "versiunea",
    cta: "Deschide configuratorul",
  },
  planLimit: {
    subject: "Limita planului a fost atinsă — onespec",
    title: "Limita planului",
    locked: (l) =>
      `Limita lunară a fost atinsă (${l} cereri). Cererile noi sunt salvate, dar datele de contact rămân ascunse până treci pe un plan superior sau până la 1 ale lunii.`,
    unlocked: (l) =>
      `Limita lunară a fost atinsă (${l} cereri). Cererile noi sunt salvate în continuare — treci pe un plan superior pentru a mări limita.`,
    cta: "Gestionează planul",
  },
  system: { subject: "Notificare — onespec", title: "Notificare", open: "Deschide" },
  invitation: {
    subject: (c) => `Invitație în onespec — ${c}`,
    title: "Invitație de colaborare",
    body: (i, c, r) => `${i} te-a invitat să lucrezi pentru <strong>${c}</strong> în onespec ca <strong>${r}</strong>.`,
    colleague: "Un coleg",
    company: "o companie",
    roles: { admin: "administrator", member: "membru" },
    cta: "Acceptă invitația",
    expires: "Invitația expiră în 7 zile.",
    text: "Ai fost invitat în onespec",
  },
  teamAccess: {
    invite: {
      subject: (c) => `Accesul tău la ${c} pe onespec`,
      title: "Ai fost invitat în echipă",
      body: (i, c, t, g) => `${i} te-a invitat să te alături <strong>${c}</strong> (grupul <strong>${t}</strong>) ca <strong>${g}</strong>.`,
    },
    login: {
      subject: (c) => `Codul tău de acces la ${c}`,
      title: "Intră în echipa ta",
      body: (c, t) => `Ai cerut să intri în <strong>${c}</strong> (grupul <strong>${t}</strong>).`,
    },
    colleague: "Un coleg",
    company: "o companie",
    codeLabel: "Codul tău de verificare",
    cta: "Deschide pagina de acces",
    howTo: "Pentru a intra îți trebuie trei lucruri: acest link, codul de mai sus și parola grupului, pe care ți-o dă personal cine te-a invitat. Parola nu este scrisă în acest e-mail.",
    expires7: "Linkul și codul expiră în 7 zile și se pot folosi o singură dată.",
    expires15: "Linkul și codul expiră în 15 minute și se pot folosi o singură dată.",
    neverShare: "Nu redirecționa acest e-mail: cine are linkul și codul și cunoaște parola grupului poate intra în locul tău.",
    text: "Acces în echipă pe onespec",
  },
  referral: {
    invited: {
      subject: "Reducerea ta de invitație — onespec",
      title: "Ai o reducere la prima plată",
      body: (p) => `Te-ai înregistrat prin invitația altei companii: primești ${p}% reducere la prima plată, aplicată automat când alegi planul.`,
      cta: "Alege planul",
    },
    registered: {
      subject: "O companie s-a înregistrat cu invitația ta — onespec",
      title: "Invitația ta a funcționat",
      body: "O companie nouă s-a înregistrat cu codul tău. După prima plată și 30 de zile fără rambursări, vei primi creditul pe abonament.",
      cta: "Vezi invitațiile tale",
    },
    rewarded: {
      subject: (a) => `Ai primit ${a} credit — onespec`,
      title: "Credit de invitație adăugat",
      body: (a) => `Am adăugat ${a} credit în contul tău: va fi dedus din următoarele facturi de abonament. Mulțumim că ai adus un client nou.`,
      cta: "Vezi invitațiile tale",
    },
    paid: {
      subject: (a) => `Ți-am trimis ${a} — onespec`,
      title: "Recompensă de invitație plătită",
      body: (a) => `Am transferat ${a} în contul tău Stripe conectat: îl vei vedea printre plățile tale Stripe în următoarele zile. Mulțumim că ai adus un client nou.`,
      cta: "Vezi invitațiile tale",
    },
  },
  notification: "Notificare",
};

const STRINGS: Record<EmailLocale, EmailStrings> = { it, en, fr, de, nl, ro };

/** Unknown locales fall back to Italian, the platform's default market. */
export function emailStrings(locale: string | null | undefined): EmailStrings {
  return STRINGS[(locale ?? "") as EmailLocale] ?? STRINGS.it;
}

export function isEmailLocale(locale: unknown): locale is EmailLocale {
  return typeof locale === "string" && (EMAIL_LOCALES as string[]).includes(locale);
}
