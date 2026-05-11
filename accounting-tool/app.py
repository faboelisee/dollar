from flask import Flask, render_template, request, redirect, url_for, flash, make_response
from flask_sqlalchemy import SQLAlchemy
from datetime import date, datetime, timedelta
import csv
import io

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cabinet-expertise-comptable-2024'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cabinet.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ─── Models ────────────────────────────────────────────────────────────────────

class Client(db.Model):
    __tablename__ = 'clients'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    nom = db.Column(db.String(150), nullable=False)
    type_client = db.Column(db.String(50), nullable=False, default='PME')  # PME, GE, Association, TPE
    contact = db.Column(db.String(150))
    email = db.Column(db.String(150))
    telephone = db.Column(db.String(30))
    exercice_fiscal = db.Column(db.String(20), default='31/12')
    statut = db.Column(db.String(30), default='Actif')  # Actif, Inactif, Prospect
    date_entree = db.Column(db.Date, default=date.today)
    notes = db.Column(db.Text)
    taches = db.relationship('Tache', backref='client', lazy=True, cascade='all, delete-orphan')

    @property
    def nb_taches_ouvertes(self):
        return sum(1 for t in self.taches if t.statut != 'Terminée')

    @property
    def nb_taches_en_retard(self):
        return sum(1 for t in self.taches if t.statut != 'Terminée' and t.echeance and t.echeance < date.today())


class Collaborateur(db.Model):
    __tablename__ = 'collaborateurs'
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(150), nullable=False)
    prenom = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(80), nullable=False, default='Assistant')  # Associé, Manager, Senior, Assistant
    email = db.Column(db.String(150))
    telephone = db.Column(db.String(30))
    actif = db.Column(db.Boolean, default=True)
    taches = db.relationship('Tache', backref='collaborateur', lazy=True)

    @property
    def nom_complet(self):
        return f"{self.prenom} {self.nom}"

    @property
    def nb_taches_actives(self):
        return sum(1 for t in self.taches if t.statut != 'Terminée')

    @property
    def nb_taches_en_retard(self):
        return sum(1 for t in self.taches if t.statut != 'Terminée' and t.echeance and t.echeance < date.today())


class Tache(db.Model):
    __tablename__ = 'taches'
    id = db.Column(db.Integer, primary_key=True)
    titre = db.Column(db.String(200), nullable=False)
    type_tache = db.Column(db.String(80), nullable=False, default='Comptabilité')
    # Audit, Comptabilité, Fiscalité, Social, Juridique, Autre
    description = db.Column(db.Text)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    collaborateur_id = db.Column(db.Integer, db.ForeignKey('collaborateurs.id'))
    echeance = db.Column(db.Date)
    date_creation = db.Column(db.Date, default=date.today)
    date_cloture = db.Column(db.Date)
    statut = db.Column(db.String(40), default='En attente')
    # En attente, En cours, En révision, Terminée
    priorite = db.Column(db.String(20), default='Normale')  # Haute, Normale, Basse
    heures_estimees = db.Column(db.Float, default=0)
    heures_realisees = db.Column(db.Float, default=0)
    exercice = db.Column(db.String(20))  # ex: 2024

    @property
    def est_en_retard(self):
        return self.statut != 'Terminée' and self.echeance and self.echeance < date.today()

    @property
    def jours_restants(self):
        if not self.echeance:
            return None
        return (self.echeance - date.today()).days

    @property
    def badge_statut(self):
        return {
            'En attente': 'secondary',
            'En cours': 'primary',
            'En révision': 'warning',
            'Terminée': 'success',
        }.get(self.statut, 'secondary')

    @property
    def badge_priorite(self):
        return {'Haute': 'danger', 'Normale': 'primary', 'Basse': 'secondary'}.get(self.priorite, 'primary')


# ─── Context processors ────────────────────────────────────────────────────────

@app.context_processor
def inject_stats():
    today = date.today()
    nb_retard = Tache.query.filter(
        Tache.statut != 'Terminée',
        Tache.echeance < today
    ).count()
    nb_echeance_proche = Tache.query.filter(
        Tache.statut != 'Terminée',
        Tache.echeance >= today,
        Tache.echeance <= today + timedelta(days=7)
    ).count()
    return dict(nb_retard_global=nb_retard, nb_echeance_proche=nb_echeance_proche, today=today)


# ─── Dashboard ─────────────────────────────────────────────────────────────────

@app.route('/')
def dashboard():
    today = date.today()
    stats = {
        'nb_clients': Client.query.filter_by(statut='Actif').count(),
        'nb_collaborateurs': Collaborateur.query.filter_by(actif=True).count(),
        'nb_taches_ouvertes': Tache.query.filter(Tache.statut != 'Terminée').count(),
        'nb_taches_retard': Tache.query.filter(
            Tache.statut != 'Terminée', Tache.echeance < today).count(),
    }
    taches_urgentes = Tache.query.filter(
        Tache.statut != 'Terminée',
        Tache.echeance != None
    ).order_by(Tache.echeance.asc()).limit(8).all()

    taches_recentes = Tache.query.order_by(Tache.date_creation.desc()).limit(5).all()

    # Charge par collaborateur
    collabs = Collaborateur.query.filter_by(actif=True).all()
    charge_collabs = [
        {'nom': c.nom_complet, 'role': c.role,
         'actives': c.nb_taches_actives, 'retard': c.nb_taches_en_retard}
        for c in collabs
    ]

    return render_template('dashboard.html', stats=stats,
                           taches_urgentes=taches_urgentes,
                           taches_recentes=taches_recentes,
                           charge_collabs=charge_collabs)


# ─── Clients ───────────────────────────────────────────────────────────────────

@app.route('/clients')
def clients():
    statut = request.args.get('statut', '')
    q = request.args.get('q', '')
    query = Client.query
    if statut:
        query = query.filter_by(statut=statut)
    if q:
        query = query.filter(Client.nom.ilike(f'%{q}%') | Client.code.ilike(f'%{q}%'))
    clients_list = query.order_by(Client.nom).all()
    return render_template('clients.html', clients=clients_list, statut=statut, q=q)


@app.route('/clients/nouveau', methods=['GET', 'POST'])
def nouveau_client():
    if request.method == 'POST':
        code = request.form['code'].strip().upper()
        if Client.query.filter_by(code=code).first():
            flash('Ce code client existe déjà.', 'danger')
            return render_template('client_form.html', client=None, form=request.form)
        client = Client(
            code=code,
            nom=request.form['nom'].strip(),
            type_client=request.form['type_client'],
            contact=request.form.get('contact', ''),
            email=request.form.get('email', ''),
            telephone=request.form.get('telephone', ''),
            exercice_fiscal=request.form.get('exercice_fiscal', '31/12'),
            statut=request.form.get('statut', 'Actif'),
            notes=request.form.get('notes', ''),
        )
        db.session.add(client)
        db.session.commit()
        flash(f'Client {client.nom} créé avec succès.', 'success')
        return redirect(url_for('clients'))
    return render_template('client_form.html', client=None, form={})


@app.route('/clients/<int:id>')
def detail_client(id):
    client = Client.query.get_or_404(id)
    taches = Tache.query.filter_by(client_id=id).order_by(Tache.echeance.asc()).all()
    return render_template('client_detail.html', client=client, taches=taches)


@app.route('/clients/<int:id>/modifier', methods=['GET', 'POST'])
def modifier_client(id):
    client = Client.query.get_or_404(id)
    if request.method == 'POST':
        code = request.form['code'].strip().upper()
        existing = Client.query.filter_by(code=code).first()
        if existing and existing.id != id:
            flash('Ce code client existe déjà.', 'danger')
            return render_template('client_form.html', client=client, form=request.form)
        client.code = code
        client.nom = request.form['nom'].strip()
        client.type_client = request.form['type_client']
        client.contact = request.form.get('contact', '')
        client.email = request.form.get('email', '')
        client.telephone = request.form.get('telephone', '')
        client.exercice_fiscal = request.form.get('exercice_fiscal', '31/12')
        client.statut = request.form.get('statut', 'Actif')
        client.notes = request.form.get('notes', '')
        db.session.commit()
        flash(f'Client {client.nom} modifié.', 'success')
        return redirect(url_for('detail_client', id=id))
    return render_template('client_form.html', client=client, form=client.__dict__)


@app.route('/clients/<int:id>/supprimer', methods=['POST'])
def supprimer_client(id):
    client = Client.query.get_or_404(id)
    nom = client.nom
    db.session.delete(client)
    db.session.commit()
    flash(f'Client {nom} supprimé.', 'warning')
    return redirect(url_for('clients'))


# ─── Collaborateurs ────────────────────────────────────────────────────────────

@app.route('/collaborateurs')
def collaborateurs():
    collabs = Collaborateur.query.order_by(Collaborateur.nom).all()
    return render_template('collaborateurs.html', collaborateurs=collabs)


@app.route('/collaborateurs/nouveau', methods=['GET', 'POST'])
def nouveau_collaborateur():
    if request.method == 'POST':
        c = Collaborateur(
            nom=request.form['nom'].strip(),
            prenom=request.form['prenom'].strip(),
            role=request.form['role'],
            email=request.form.get('email', ''),
            telephone=request.form.get('telephone', ''),
        )
        db.session.add(c)
        db.session.commit()
        flash(f'{c.nom_complet} ajouté(e).', 'success')
        return redirect(url_for('collaborateurs'))
    return render_template('collaborateur_form.html', collab=None, form={})


@app.route('/collaborateurs/<int:id>/modifier', methods=['GET', 'POST'])
def modifier_collaborateur(id):
    c = Collaborateur.query.get_or_404(id)
    if request.method == 'POST':
        c.nom = request.form['nom'].strip()
        c.prenom = request.form['prenom'].strip()
        c.role = request.form['role']
        c.email = request.form.get('email', '')
        c.telephone = request.form.get('telephone', '')
        c.actif = 'actif' in request.form
        db.session.commit()
        flash(f'{c.nom_complet} modifié(e).', 'success')
        return redirect(url_for('collaborateurs'))
    return render_template('collaborateur_form.html', collab=c, form=c.__dict__)


@app.route('/collaborateurs/<int:id>/supprimer', methods=['POST'])
def supprimer_collaborateur(id):
    c = Collaborateur.query.get_or_404(id)
    nom = c.nom_complet
    # Désassigner les tâches
    for t in c.taches:
        t.collaborateur_id = None
    db.session.delete(c)
    db.session.commit()
    flash(f'{nom} supprimé(e).', 'warning')
    return redirect(url_for('collaborateurs'))


# ─── Tâches ────────────────────────────────────────────────────────────────────

@app.route('/taches')
def taches():
    statut = request.args.get('statut', '')
    priorite = request.args.get('priorite', '')
    collab_id = request.args.get('collab', '')
    client_id = request.args.get('client', '')
    retard = request.args.get('retard', '')

    query = Tache.query
    if statut:
        query = query.filter_by(statut=statut)
    if priorite:
        query = query.filter_by(priorite=priorite)
    if collab_id:
        query = query.filter_by(collaborateur_id=int(collab_id))
    if client_id:
        query = query.filter_by(client_id=int(client_id))
    if retard:
        query = query.filter(Tache.statut != 'Terminée', Tache.echeance < date.today())

    taches_list = query.order_by(Tache.echeance.asc().nullslast()).all()
    clients_list = Client.query.order_by(Client.nom).all()
    collabs_list = Collaborateur.query.filter_by(actif=True).order_by(Collaborateur.nom).all()

    return render_template('taches.html', taches=taches_list,
                           clients=clients_list, collaborateurs=collabs_list,
                           statut=statut, priorite=priorite,
                           collab_id=collab_id, client_id=client_id, retard=retard)


@app.route('/taches/nouvelle', methods=['GET', 'POST'])
def nouvelle_tache():
    clients_list = Client.query.filter_by(statut='Actif').order_by(Client.nom).all()
    collabs_list = Collaborateur.query.filter_by(actif=True).order_by(Collaborateur.nom).all()
    if request.method == 'POST':
        echeance = request.form.get('echeance')
        t = Tache(
            titre=request.form['titre'].strip(),
            type_tache=request.form['type_tache'],
            description=request.form.get('description', ''),
            client_id=int(request.form['client_id']),
            collaborateur_id=int(request.form['collaborateur_id']) if request.form.get('collaborateur_id') else None,
            echeance=datetime.strptime(echeance, '%Y-%m-%d').date() if echeance else None,
            statut=request.form.get('statut', 'En attente'),
            priorite=request.form.get('priorite', 'Normale'),
            heures_estimees=float(request.form.get('heures_estimees') or 0),
            exercice=request.form.get('exercice', ''),
        )
        db.session.add(t)
        db.session.commit()
        flash('Tâche créée avec succès.', 'success')
        return redirect(url_for('taches'))
    preselect_client = request.args.get('client_id')
    return render_template('tache_form.html', tache=None, clients=clients_list,
                           collaborateurs=collabs_list, form={}, preselect_client=preselect_client)


@app.route('/taches/<int:id>/modifier', methods=['GET', 'POST'])
def modifier_tache(id):
    t = Tache.query.get_or_404(id)
    clients_list = Client.query.order_by(Client.nom).all()
    collabs_list = Collaborateur.query.filter_by(actif=True).order_by(Collaborateur.nom).all()
    if request.method == 'POST':
        echeance = request.form.get('echeance')
        t.titre = request.form['titre'].strip()
        t.type_tache = request.form['type_tache']
        t.description = request.form.get('description', '')
        t.client_id = int(request.form['client_id'])
        t.collaborateur_id = int(request.form['collaborateur_id']) if request.form.get('collaborateur_id') else None
        t.echeance = datetime.strptime(echeance, '%Y-%m-%d').date() if echeance else None
        t.priorite = request.form.get('priorite', 'Normale')
        t.heures_estimees = float(request.form.get('heures_estimees') or 0)
        t.heures_realisees = float(request.form.get('heures_realisees') or 0)
        t.exercice = request.form.get('exercice', '')
        ancien_statut = t.statut
        t.statut = request.form.get('statut', t.statut)
        if t.statut == 'Terminée' and ancien_statut != 'Terminée':
            t.date_cloture = date.today()
        db.session.commit()
        flash('Tâche modifiée.', 'success')
        return redirect(url_for('taches'))
    return render_template('tache_form.html', tache=t, clients=clients_list,
                           collaborateurs=collabs_list, form={}, preselect_client=None)


@app.route('/taches/<int:id>/statut', methods=['POST'])
def changer_statut(id):
    t = Tache.query.get_or_404(id)
    nouveau = request.form.get('statut')
    if nouveau:
        if nouveau == 'Terminée' and t.statut != 'Terminée':
            t.date_cloture = date.today()
        t.statut = nouveau
        db.session.commit()
        flash(f'Statut mis à jour : {nouveau}', 'success')
    return redirect(request.referrer or url_for('taches'))


@app.route('/taches/<int:id>/supprimer', methods=['POST'])
def supprimer_tache(id):
    t = Tache.query.get_or_404(id)
    db.session.delete(t)
    db.session.commit()
    flash('Tâche supprimée.', 'warning')
    return redirect(url_for('taches'))


# ─── Rapports ──────────────────────────────────────────────────────────────────

@app.route('/rapports')
def rapports():
    today = date.today()
    # Rapport global
    total_taches = Tache.query.count()
    taches_terminees = Tache.query.filter_by(statut='Terminée').count()
    taches_retard = Tache.query.filter(Tache.statut != 'Terminée', Tache.echeance < today).count()
    taux_completion = round(taches_terminees / total_taches * 100, 1) if total_taches else 0

    # Par type de tâche
    types = ['Audit', 'Comptabilité', 'Fiscalité', 'Social', 'Juridique', 'Autre']
    stats_types = []
    for typ in types:
        total = Tache.query.filter_by(type_tache=typ).count()
        terminees = Tache.query.filter_by(type_tache=typ, statut='Terminée').count()
        if total:
            stats_types.append({'type': typ, 'total': total, 'terminees': terminees,
                                 'taux': round(terminees / total * 100)})

    # Par collaborateur
    collabs = Collaborateur.query.filter_by(actif=True).all()
    stats_collabs = []
    for c in collabs:
        total = len(c.taches)
        terminees = sum(1 for t in c.taches if t.statut == 'Terminée')
        en_cours = sum(1 for t in c.taches if t.statut == 'En cours')
        retard = sum(1 for t in c.taches if t.statut != 'Terminée' and t.echeance and t.echeance < today)
        heures_est = sum(t.heures_estimees or 0 for t in c.taches)
        heures_real = sum(t.heures_realisees or 0 for t in c.taches)
        stats_collabs.append({
            'collab': c, 'total': total, 'terminees': terminees,
            'en_cours': en_cours, 'retard': retard,
            'heures_est': heures_est, 'heures_real': heures_real,
        })

    # Par client (top 10 charge)
    clients_list = Client.query.filter_by(statut='Actif').all()
    stats_clients = sorted([
        {'client': c,
         'total': len(c.taches),
         'ouvertes': c.nb_taches_ouvertes,
         'retard': c.nb_taches_en_retard}
        for c in clients_list
    ], key=lambda x: x['total'], reverse=True)[:10]

    # Tâches en retard
    taches_en_retard = Tache.query.filter(
        Tache.statut != 'Terminée', Tache.echeance < today
    ).order_by(Tache.echeance.asc()).all()

    # Échéances 30 prochains jours
    echeances = Tache.query.filter(
        Tache.statut != 'Terminée',
        Tache.echeance >= today,
        Tache.echeance <= today + timedelta(days=30)
    ).order_by(Tache.echeance.asc()).all()

    return render_template('rapports.html',
                           total_taches=total_taches,
                           taches_terminees=taches_terminees,
                           taches_retard=taches_retard,
                           taux_completion=taux_completion,
                           stats_types=stats_types,
                           stats_collabs=stats_collabs,
                           stats_clients=stats_clients,
                           taches_en_retard=taches_en_retard,
                           echeances=echeances)


@app.route('/rapports/export/csv')
def export_csv():
    taches = Tache.query.order_by(Tache.echeance.asc()).all()
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow([
        'ID', 'Titre', 'Type', 'Client', 'Collaborateur', 'Statut',
        'Priorité', 'Exercice', 'Échéance', 'Date création', 'Date clôture',
        'H. estimées', 'H. réalisées', 'Description'
    ])
    for t in taches:
        writer.writerow([
            t.id, t.titre, t.type_tache,
            t.client.nom if t.client else '',
            t.collaborateur.nom_complet if t.collaborateur else '',
            t.statut, t.priorite, t.exercice or '',
            t.echeance.strftime('%d/%m/%Y') if t.echeance else '',
            t.date_creation.strftime('%d/%m/%Y') if t.date_creation else '',
            t.date_cloture.strftime('%d/%m/%Y') if t.date_cloture else '',
            t.heures_estimees or '', t.heures_realisees or '',
            t.description or ''
        ])
    response = make_response(output.getvalue())
    response.headers['Content-Disposition'] = 'attachment; filename=taches_export.csv'
    response.headers['Content-type'] = 'text/csv; charset=utf-8'
    return response


@app.route('/rapports/export/clients/csv')
def export_clients_csv():
    clients_list = Client.query.order_by(Client.nom).all()
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(['Code', 'Nom', 'Type', 'Statut', 'Contact', 'Email',
                     'Téléphone', 'Exercice fiscal', 'Date entrée', 'Tâches ouvertes', 'Notes'])
    for c in clients_list:
        writer.writerow([
            c.code, c.nom, c.type_client, c.statut,
            c.contact or '', c.email or '', c.telephone or '',
            c.exercice_fiscal or '',
            c.date_entree.strftime('%d/%m/%Y') if c.date_entree else '',
            c.nb_taches_ouvertes, c.notes or ''
        ])
    response = make_response(output.getvalue())
    response.headers['Content-Disposition'] = 'attachment; filename=clients_export.csv'
    response.headers['Content-type'] = 'text/csv; charset=utf-8'
    return response


# ─── Init DB ───────────────────────────────────────────────────────────────────

def seed_demo():
    """Insère des données de démonstration."""
    if Client.query.count():
        return
    collabs = [
        Collaborateur(nom='Martin', prenom='Sophie', role='Manager', email='s.martin@cabinet.fr'),
        Collaborateur(nom='Dubois', prenom='Pierre', role='Senior', email='p.dubois@cabinet.fr'),
        Collaborateur(nom='Leroy', prenom='Marie', role='Assistant', email='m.leroy@cabinet.fr'),
    ]
    for c in collabs:
        db.session.add(c)
    clients = [
        Client(code='CLI001', nom='Boulangerie Martin SARL', type_client='TPE',
               contact='Jean Martin', email='jmartin@boulangerie.fr', statut='Actif', exercice_fiscal='31/12'),
        Client(code='CLI002', nom='Groupe Technova SAS', type_client='PME',
               contact='Aline Dupont', email='a.dupont@technova.fr', statut='Actif', exercice_fiscal='30/06'),
        Client(code='CLI003', nom='Association Solidarité 44', type_client='Association',
               contact='Robert Blanc', statut='Actif', exercice_fiscal='31/12'),
        Client(code='CLI004', nom='Méga Industries SA', type_client='GE',
               contact='Céline Morin', email='c.morin@mega.fr', statut='Actif', exercice_fiscal='31/12'),
    ]
    for c in clients:
        db.session.add(c)
    db.session.flush()

    today = date.today()
    taches_demo = [
        Tache(titre='Révision comptes annuels 2024', type_tache='Audit',
              client_id=clients[0].id, collaborateur_id=collabs[0].id,
              echeance=today + timedelta(days=15), statut='En cours', priorite='Haute',
              exercice='2024', heures_estimees=20),
        Tache(titre='Déclaration TVA T1 2025', type_tache='Fiscalité',
              client_id=clients[1].id, collaborateur_id=collabs[1].id,
              echeance=today + timedelta(days=5), statut='En attente', priorite='Haute',
              exercice='2025', heures_estimees=4),
        Tache(titre='Saisie comptable janvier 2025', type_tache='Comptabilité',
              client_id=clients[0].id, collaborateur_id=collabs[2].id,
              echeance=today - timedelta(days=3), statut='En cours', priorite='Normale',
              exercice='2025', heures_estimees=8),
        Tache(titre='Bilan social annuel', type_tache='Social',
              client_id=clients[2].id, collaborateur_id=collabs[1].id,
              echeance=today + timedelta(days=30), statut='En attente', priorite='Normale',
              exercice='2024', heures_estimees=6),
        Tache(titre='Audit légal exercice 2024', type_tache='Audit',
              client_id=clients[3].id, collaborateur_id=collabs[0].id,
              echeance=today + timedelta(days=45), statut='En attente', priorite='Haute',
              exercice='2024', heures_estimees=60),
        Tache(titre='Liasse fiscale 2024', type_tache='Fiscalité',
              client_id=clients[1].id, collaborateur_id=collabs[2].id,
              echeance=today - timedelta(days=10), statut='Terminée', priorite='Haute',
              exercice='2024', heures_estimees=10, heures_realisees=12,
              date_cloture=today - timedelta(days=2)),
    ]
    for t in taches_demo:
        db.session.add(t)
    db.session.commit()


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_demo()
    app.run(debug=True, port=5000)
