# FinanceFlow

Application de gestion financière personnelle construite à partir des écrans Google Stitch fournis dans `stitch_finance_dashboard_manager/`.

## Démarrer en local

Node.js 20 ou plus récent est requis.

```sh
npm ci
npm run dev
```

Le client Vite écoute sur `http://localhost:5173` et le serveur API sur `http://localhost:3001`. Sans `DATABASE_URL`, une base SQLite locale est créée dans `data/` pour le développement et les tests. Elle est ignorée par Git.

Pour utiliser Aiven en local, définir `DATABASE_URL` dans l’environnement avant de démarrer. Le serveur vérifie le certificat TLS avec `certs/aiven-ca.pem` ; `MYSQL_CA_PATH` peut pointer vers un autre certificat après une rotation Aiven. En production, `DATABASE_URL` est obligatoire et aucune base locale n’est utilisée.

```sh
npm run build
npm test
```

## Déploiement Render Blueprint

Le fichier `render.yaml` définit deux services gratuits : `financeflow-app`, un site statique Render pour le client React, et `financeflow`, le service Node de l’API Express. Le site statique affiche l’interface immédiatement. Ses routes `/api/*` sont réécrites vers le service Node, ce qui conserve les cookies de session sur le domaine du site. Les autres routes renvoient `index.html` pour React Router.

Lors de la création du Blueprint dans Render, saisir `DATABASE_URL` dans le champ secret demandé pour le service Node. Le format est `mysql://UTILISATEUR:MOT_DE_PASSE@HOTE:PORT/NOM_BASE`. Ne jamais inscrire ce secret dans le dépôt. Le site statique public est [financeflow-app-eaip.onrender.com](https://financeflow-app-eaip.onrender.com). Sa valeur `FRONTEND_ORIGIN` est inscrite dans le Blueprint pour autoriser les requêtes d’écriture provenant de ce domaine.

Le certificat CA Aiven fourni pour ce projet est dans `certs/aiven-ca.pem`. Après rotation du certificat côté Aiven, remplacer le fichier et redéployer. Le point de santé `/health` vérifie aussi l’accès à la base. Les tables sont créées au démarrage si elles n’existent pas.

Le site statique reste disponible sans réveil. L’API gratuite peut s’endormir après 15 minutes d’inactivité ; au premier accès, FinanceFlow affiche son propre écran de chargement pendant que l’API redémarre. La base MySQL demeure sur Aiven et ne dépend pas du stockage éphémère Render.

## Installation et usage hors ligne

Depuis **Paramètres → Application sur cet appareil**, installer FinanceFlow avec le bouton proposé par Chrome ou Edge. Si le navigateur ne propose pas de bouton, utiliser son menu « Installer l’application » ; sur iPhone, utiliser Partager → « Sur l’écran d’accueil ». Après un premier chargement en ligne, le service worker conserve l’interface, ses polices et ses icônes. Les réponses des pages consultées sont conservées localement dans IndexedDB pour une consultation hors ligne sur le même appareil et le même compte. Une bannière indique la perte de connexion. De nouvelles transactions peuvent être saisies hors ligne : elles apparaissent dans une liste d’attente et sont envoyées à la reconnexion. Un identifiant unique évite leur duplication en cas de nouvel essai, et le taux au moment de la saisie est conservé. Si la session a expiré, se reconnecter pour relancer l’envoi. Les autres écritures exigent Internet. La déconnexion efface les copies de consultation et est bloquée tant qu’une transaction attend d’être synchronisée ou annulée.

## Sécurité et devises

Chaque opération SQL relative aux données financières est limitée par `user_id`. Les mots de passe sont dérivés avec `scrypt`, les sessions utilisent un cookie `HttpOnly` et leurs jetons sont hachés dans la base. À l’inscription, conserver le code de récupération affiché une seule fois : il remplace l’envoi d’email, qui nécessiterait un fournisseur de messagerie.

Les comptes et opérations acceptent USD et CDF. Les transferts exigent deux comptes de même devise. Le taux manuel `1 USD = … CDF` se règle dans **Paramètres** et est enregistré sur chaque nouvelle transaction. Sa contre-valeur affichée dans l’historique reste donc stable quand le taux change. Les anciennes transactions n’acquièrent pas de taux rétroactivement, les montants enregistrés ne changent pas et les analyses restent séparées par devise. Aucun taux de marché automatique n’est utilisé. Les récurrences sont planifiées et visibles ; leur exécution automatique n’est pas encore activée.
