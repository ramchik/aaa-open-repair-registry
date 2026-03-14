import os
import io
import csv
from datetime import datetime, date

from flask import (
    Flask, render_template, request, redirect, url_for, flash,
    send_file, jsonify
)
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(basedir, "registry.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "carotid-registry-secret-key-change-me")

db = SQLAlchemy(app)

# ---------------------------------------------------------------------------
# DATABASE MODELS
# ---------------------------------------------------------------------------

class Patient(db.Model):
    __tablename__ = "patient"
    patient_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    hospital_id = db.Column(db.String(50), unique=True)
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    date_of_birth = db.Column(db.Date)
    age = db.Column(db.Integer)
    sex = db.Column(db.String(10))
    height = db.Column(db.Float)
    weight = db.Column(db.Float)
    bmi = db.Column(db.Float)
    ethnicity = db.Column(db.String(50))
    smoking_status = db.Column(db.String(30))
    alcohol_use = db.Column(db.String(30))

    medical_history = db.relationship("MedicalHistory", backref="patient", uselist=False, cascade="all, delete-orphan")
    medications = db.relationship("Medications", backref="patient", uselist=False, cascade="all, delete-orphan")
    imaging = db.relationship("CarotidImaging", backref="patient", cascade="all, delete-orphan")
    laboratory = db.relationship("Laboratory", backref="patient", cascade="all, delete-orphan")
    neurological = db.relationship("NeurologicalStatus", backref="patient", uselist=False, cascade="all, delete-orphan")
    procedures = db.relationship("Procedure", backref="patient", cascade="all, delete-orphan")


class MedicalHistory(db.Model):
    __tablename__ = "medical_history"
    history_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patient.patient_id"), nullable=False)
    hypertension = db.Column(db.Boolean, default=False)
    diabetes = db.Column(db.Boolean, default=False)
    dyslipidemia = db.Column(db.Boolean, default=False)
    coronary_artery_disease = db.Column(db.Boolean, default=False)
    previous_mi = db.Column(db.Boolean, default=False)
    previous_stroke = db.Column(db.Boolean, default=False)
    previous_tia = db.Column(db.Boolean, default=False)
    peripheral_arterial_disease = db.Column(db.Boolean, default=False)
    atrial_fibrillation = db.Column(db.Boolean, default=False)
    heart_failure = db.Column(db.Boolean, default=False)
    chronic_kidney_disease = db.Column(db.Boolean, default=False)
    copd = db.Column(db.Boolean, default=False)
    malignancy = db.Column(db.Boolean, default=False)
    previous_carotid_surgery = db.Column(db.Boolean, default=False)


class Medications(db.Model):
    __tablename__ = "medications"
    medication_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patient.patient_id"), nullable=False)
    aspirin = db.Column(db.Boolean, default=False)
    clopidogrel = db.Column(db.Boolean, default=False)
    dual_antiplatelet = db.Column(db.Boolean, default=False)
    anticoagulation = db.Column(db.Boolean, default=False)
    statin = db.Column(db.Boolean, default=False)
    pcsk9_inhibitor = db.Column(db.Boolean, default=False)
    antihypertensive = db.Column(db.Boolean, default=False)


class CarotidImaging(db.Model):
    __tablename__ = "carotid_imaging"
    imaging_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patient.patient_id"), nullable=False)
    imaging_date = db.Column(db.Date)
    modality = db.Column(db.String(50))
    stenosis_degree_nascet = db.Column(db.Float)
    stenosis_degree_ecst = db.Column(db.Float)
    plaque_type = db.Column(db.String(50))
    plaque_ulceration = db.Column(db.Boolean, default=False)
    plaque_calcification = db.Column(db.Boolean, default=False)
    plaque_echolucency = db.Column(db.Boolean, default=False)
    contralateral_stenosis = db.Column(db.Float)
    contralateral_occlusion = db.Column(db.Boolean, default=False)
    vertebral_artery_disease = db.Column(db.Boolean, default=False)

    duplex = db.relationship("DuplexParameters", backref="imaging", uselist=False, cascade="all, delete-orphan")


class DuplexParameters(db.Model):
    __tablename__ = "duplex_parameters"
    duplex_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    imaging_id = db.Column(db.Integer, db.ForeignKey("carotid_imaging.imaging_id"), nullable=False)
    peak_systolic_velocity = db.Column(db.Float)
    end_diastolic_velocity = db.Column(db.Float)
    ica_cca_ratio = db.Column(db.Float)


class Laboratory(db.Model):
    __tablename__ = "laboratory"
    lab_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patient.patient_id"), nullable=False)
    lab_date = db.Column(db.Date)
    ldl = db.Column(db.Float)
    hdl = db.Column(db.Float)
    total_cholesterol = db.Column(db.Float)
    triglycerides = db.Column(db.Float)
    hba1c = db.Column(db.Float)
    creatinine = db.Column(db.Float)
    crp = db.Column(db.Float)
    homocysteine = db.Column(db.Float)
    platelet_count = db.Column(db.Float)
    d_dimer = db.Column(db.Float)


class NeurologicalStatus(db.Model):
    __tablename__ = "neurological_status"
    neuro_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patient.patient_id"), nullable=False)
    symptomatic = db.Column(db.Boolean, default=False)
    symptom_type = db.Column(db.String(50))
    symptom_date = db.Column(db.Date)
    nihss_score = db.Column(db.Integer)
    modified_rankin_scale = db.Column(db.Integer)
    amaurosis_fugax = db.Column(db.Boolean, default=False)


class Procedure(db.Model):
    __tablename__ = "procedure"
    procedure_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patient.patient_id"), nullable=False)
    procedure_date = db.Column(db.Date)
    procedure_type = db.Column(db.String(10))  # CEA or CAS
    side = db.Column(db.String(10))
    indication = db.Column(db.String(100))
    stenosis_degree = db.Column(db.Float)
    symptomatic_status = db.Column(db.String(30))

    cea_details = db.relationship("CEADetails", backref="procedure", uselist=False, cascade="all, delete-orphan")
    cas_details = db.relationship("CASDetails", backref="procedure", uselist=False, cascade="all, delete-orphan")
    intraoperative_events = db.relationship("IntraoperativeEvents", backref="procedure", uselist=False, cascade="all, delete-orphan")
    complications = db.relationship("Complications", backref="procedure", uselist=False, cascade="all, delete-orphan")
    followups = db.relationship("FollowUp", backref="procedure", cascade="all, delete-orphan")


class CEADetails(db.Model):
    __tablename__ = "cea_details"
    cea_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    procedure_id = db.Column(db.Integer, db.ForeignKey("procedure.procedure_id"), nullable=False)
    anesthesia_type = db.Column(db.String(30))
    shunt_used = db.Column(db.Boolean, default=False)
    patch_used = db.Column(db.Boolean, default=False)
    patch_type = db.Column(db.String(50))
    clamp_time = db.Column(db.Integer)
    closure_type = db.Column(db.String(50))
    monitoring_type = db.Column(db.String(50))


class CASDetails(db.Model):
    __tablename__ = "cas_details"
    cas_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    procedure_id = db.Column(db.Integer, db.ForeignKey("procedure.procedure_id"), nullable=False)
    access_site = db.Column(db.String(50))
    embolic_protection = db.Column(db.String(50))
    stent_type = db.Column(db.String(50))
    stent_diameter = db.Column(db.Float)
    stent_length = db.Column(db.Float)
    predilatation = db.Column(db.Boolean, default=False)
    postdilatation = db.Column(db.Boolean, default=False)


class IntraoperativeEvents(db.Model):
    __tablename__ = "intraoperative_events"
    event_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    procedure_id = db.Column(db.Integer, db.ForeignKey("procedure.procedure_id"), nullable=False)
    bradycardia = db.Column(db.Boolean, default=False)
    hypotension = db.Column(db.Boolean, default=False)
    embolization = db.Column(db.Boolean, default=False)
    vessel_dissection = db.Column(db.Boolean, default=False)
    conversion_to_open = db.Column(db.Boolean, default=False)
    technical_failure = db.Column(db.Boolean, default=False)


class Complications(db.Model):
    __tablename__ = "complications"
    complication_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    procedure_id = db.Column(db.Integer, db.ForeignKey("procedure.procedure_id"), nullable=False)
    stroke = db.Column(db.Boolean, default=False)
    stroke_type = db.Column(db.String(30))
    tia = db.Column(db.Boolean, default=False)
    myocardial_infarction = db.Column(db.Boolean, default=False)
    death = db.Column(db.Boolean, default=False)
    cranial_nerve_injury = db.Column(db.Boolean, default=False)
    hyperperfusion_syndrome = db.Column(db.Boolean, default=False)
    bleeding = db.Column(db.Boolean, default=False)
    infection = db.Column(db.Boolean, default=False)


class FollowUp(db.Model):
    __tablename__ = "followup"
    followup_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    procedure_id = db.Column(db.Integer, db.ForeignKey("procedure.procedure_id"), nullable=False)
    followup_date = db.Column(db.Date)
    followup_interval = db.Column(db.String(30))
    stroke = db.Column(db.Boolean, default=False)
    tia = db.Column(db.Boolean, default=False)
    myocardial_infarction = db.Column(db.Boolean, default=False)
    death = db.Column(db.Boolean, default=False)
    ipsilateral_stroke = db.Column(db.Boolean, default=False)
    contralateral_stroke = db.Column(db.Boolean, default=False)
    reintervention = db.Column(db.Boolean, default=False)

    restenosis = db.relationship("Restenosis", backref="followup", uselist=False, cascade="all, delete-orphan")
    quality_of_life = db.relationship("QualityOfLife", backref="followup", uselist=False, cascade="all, delete-orphan")


class Restenosis(db.Model):
    __tablename__ = "restenosis"
    restenosis_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    followup_id = db.Column(db.Integer, db.ForeignKey("followup.followup_id"), nullable=False)
    restenosis_degree = db.Column(db.Float)
    peak_systolic_velocity = db.Column(db.Float)
    end_diastolic_velocity = db.Column(db.Float)
    ica_cca_ratio = db.Column(db.Float)


class QualityOfLife(db.Model):
    __tablename__ = "quality_of_life"
    qol_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    followup_id = db.Column(db.Integer, db.ForeignKey("followup.followup_id"), nullable=False)
    eq5d_score = db.Column(db.Float)
    sf36_score = db.Column(db.Float)


# ---------------------------------------------------------------------------
# HELPER – safe mean without numpy
# ---------------------------------------------------------------------------

def safe_mean(values):
    return round(sum(values) / len(values), 1) if values else 0


# ---------------------------------------------------------------------------
# ROUTES
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    patients = Patient.query.order_by(Patient.date_created.desc()).all()
    return render_template("index.html", patients=patients)


# ---- Patient CRUD --------------------------------------------------------

@app.route("/patient/new", methods=["GET", "POST"])
def patient_new():
    if request.method == "POST":
        dob_str = request.form.get("date_of_birth")
        dob = datetime.strptime(dob_str, "%Y-%m-%d").date() if dob_str else None
        age_val = request.form.get("age")
        if not age_val and dob:
            age_val = (date.today() - dob).days // 365

        height_val = float(request.form["height"]) if request.form.get("height") else None
        weight_val = float(request.form["weight"]) if request.form.get("weight") else None
        bmi_val = None
        if height_val and weight_val and height_val > 0:
            bmi_val = round(weight_val / ((height_val / 100) ** 2), 1)

        p = Patient(
            hospital_id=request.form.get("hospital_id"),
            date_of_birth=dob,
            age=int(age_val) if age_val else None,
            sex=request.form.get("sex"),
            height=height_val,
            weight=weight_val,
            bmi=bmi_val,
            ethnicity=request.form.get("ethnicity"),
            smoking_status=request.form.get("smoking_status"),
            alcohol_use=request.form.get("alcohol_use"),
        )
        db.session.add(p)
        db.session.flush()

        # Create related empty records
        db.session.add(MedicalHistory(patient_id=p.patient_id))
        db.session.add(Medications(patient_id=p.patient_id))
        db.session.add(NeurologicalStatus(patient_id=p.patient_id))
        db.session.commit()
        flash("Patient created successfully.", "success")
        return redirect(url_for("patient_view", patient_id=p.patient_id))
    return render_template("patient_form.html", patient=None)


@app.route("/patient/<int:patient_id>")
def patient_view(patient_id):
    p = Patient.query.get_or_404(patient_id)
    return render_template("patient_view.html", patient=p)


@app.route("/patient/<int:patient_id>/edit", methods=["GET", "POST"])
def patient_edit(patient_id):
    p = Patient.query.get_or_404(patient_id)
    if request.method == "POST":
        dob_str = request.form.get("date_of_birth")
        p.date_of_birth = datetime.strptime(dob_str, "%Y-%m-%d").date() if dob_str else p.date_of_birth
        age_val = request.form.get("age")
        if not age_val and p.date_of_birth:
            age_val = (date.today() - p.date_of_birth).days // 365
        p.age = int(age_val) if age_val else p.age
        p.hospital_id = request.form.get("hospital_id") or p.hospital_id
        p.sex = request.form.get("sex") or p.sex
        h = request.form.get("height")
        w = request.form.get("weight")
        p.height = float(h) if h else p.height
        p.weight = float(w) if w else p.weight
        if p.height and p.weight and p.height > 0:
            p.bmi = round(p.weight / ((p.height / 100) ** 2), 1)
        p.ethnicity = request.form.get("ethnicity") or p.ethnicity
        p.smoking_status = request.form.get("smoking_status") or p.smoking_status
        p.alcohol_use = request.form.get("alcohol_use") or p.alcohol_use
        db.session.commit()
        flash("Patient updated.", "success")
        return redirect(url_for("patient_view", patient_id=p.patient_id))
    return render_template("patient_form.html", patient=p)


@app.route("/patient/<int:patient_id>/delete", methods=["POST"])
def patient_delete(patient_id):
    p = Patient.query.get_or_404(patient_id)
    db.session.delete(p)
    db.session.commit()
    flash("Patient deleted.", "info")
    return redirect(url_for("index"))


# ---- Medical History ------------------------------------------------------

@app.route("/patient/<int:patient_id>/history", methods=["GET", "POST"])
def medical_history(patient_id):
    p = Patient.query.get_or_404(patient_id)
    h = p.medical_history or MedicalHistory(patient_id=patient_id)
    if request.method == "POST":
        bool_fields = [
            "hypertension", "diabetes", "dyslipidemia", "coronary_artery_disease",
            "previous_mi", "previous_stroke", "previous_tia",
            "peripheral_arterial_disease", "atrial_fibrillation", "heart_failure",
            "chronic_kidney_disease", "copd", "malignancy", "previous_carotid_surgery",
        ]
        for f in bool_fields:
            setattr(h, f, f in request.form)
        if not h.history_id:
            db.session.add(h)
        db.session.commit()
        flash("Medical history saved.", "success")
        return redirect(url_for("patient_view", patient_id=patient_id))
    return render_template("medical_history.html", patient=p, history=h)


# ---- Medications ----------------------------------------------------------

@app.route("/patient/<int:patient_id>/medications", methods=["GET", "POST"])
def medications(patient_id):
    p = Patient.query.get_or_404(patient_id)
    m = p.medications or Medications(patient_id=patient_id)
    if request.method == "POST":
        bool_fields = [
            "aspirin", "clopidogrel", "dual_antiplatelet", "anticoagulation",
            "statin", "pcsk9_inhibitor", "antihypertensive",
        ]
        for f in bool_fields:
            setattr(m, f, f in request.form)
        if not m.medication_id:
            db.session.add(m)
        db.session.commit()
        flash("Medications saved.", "success")
        return redirect(url_for("patient_view", patient_id=patient_id))
    return render_template("medications.html", patient=p, meds=m)


# ---- Imaging --------------------------------------------------------------

@app.route("/patient/<int:patient_id>/imaging/new", methods=["GET", "POST"])
def imaging_new(patient_id):
    p = Patient.query.get_or_404(patient_id)
    if request.method == "POST":
        img = CarotidImaging(
            patient_id=patient_id,
            imaging_date=datetime.strptime(request.form["imaging_date"], "%Y-%m-%d").date() if request.form.get("imaging_date") else None,
            modality=request.form.get("modality"),
            stenosis_degree_nascet=float(request.form["stenosis_degree_nascet"]) if request.form.get("stenosis_degree_nascet") else None,
            stenosis_degree_ecst=float(request.form["stenosis_degree_ecst"]) if request.form.get("stenosis_degree_ecst") else None,
            plaque_type=request.form.get("plaque_type"),
            plaque_ulceration="plaque_ulceration" in request.form,
            plaque_calcification="plaque_calcification" in request.form,
            plaque_echolucency="plaque_echolucency" in request.form,
            contralateral_stenosis=float(request.form["contralateral_stenosis"]) if request.form.get("contralateral_stenosis") else None,
            contralateral_occlusion="contralateral_occlusion" in request.form,
            vertebral_artery_disease="vertebral_artery_disease" in request.form,
        )
        db.session.add(img)
        db.session.flush()
        dup = DuplexParameters(
            imaging_id=img.imaging_id,
            peak_systolic_velocity=float(request.form["psv"]) if request.form.get("psv") else None,
            end_diastolic_velocity=float(request.form["edv"]) if request.form.get("edv") else None,
            ica_cca_ratio=float(request.form["ica_cca_ratio"]) if request.form.get("ica_cca_ratio") else None,
        )
        db.session.add(dup)
        db.session.commit()
        flash("Imaging record saved.", "success")
        return redirect(url_for("patient_view", patient_id=patient_id))
    return render_template("imaging_form.html", patient=p, img=None)


# ---- Laboratory -----------------------------------------------------------

@app.route("/patient/<int:patient_id>/lab/new", methods=["GET", "POST"])
def lab_new(patient_id):
    p = Patient.query.get_or_404(patient_id)
    if request.method == "POST":
        lab = Laboratory(patient_id=patient_id)
        lab.lab_date = datetime.strptime(request.form["lab_date"], "%Y-%m-%d").date() if request.form.get("lab_date") else None
        for f in ["ldl", "hdl", "total_cholesterol", "triglycerides", "hba1c",
                   "creatinine", "crp", "homocysteine", "platelet_count", "d_dimer"]:
            val = request.form.get(f)
            setattr(lab, f, float(val) if val else None)
        db.session.add(lab)
        db.session.commit()
        flash("Lab data saved.", "success")
        return redirect(url_for("patient_view", patient_id=patient_id))
    return render_template("lab_form.html", patient=p)


# ---- Neurological Status --------------------------------------------------

@app.route("/patient/<int:patient_id>/neuro", methods=["GET", "POST"])
def neuro_edit(patient_id):
    p = Patient.query.get_or_404(patient_id)
    n = p.neurological or NeurologicalStatus(patient_id=patient_id)
    if request.method == "POST":
        n.symptomatic = "symptomatic" in request.form
        n.symptom_type = request.form.get("symptom_type")
        sd = request.form.get("symptom_date")
        n.symptom_date = datetime.strptime(sd, "%Y-%m-%d").date() if sd else None
        nihss = request.form.get("nihss_score")
        n.nihss_score = int(nihss) if nihss else None
        mrs = request.form.get("modified_rankin_scale")
        n.modified_rankin_scale = int(mrs) if mrs else None
        n.amaurosis_fugax = "amaurosis_fugax" in request.form
        if not n.neuro_id:
            db.session.add(n)
        db.session.commit()
        flash("Neurological status saved.", "success")
        return redirect(url_for("patient_view", patient_id=patient_id))
    return render_template("neuro_form.html", patient=p, neuro=n)


# ---- Procedure ------------------------------------------------------------

@app.route("/patient/<int:patient_id>/procedure/new", methods=["GET", "POST"])
def procedure_new(patient_id):
    p = Patient.query.get_or_404(patient_id)
    if request.method == "POST":
        proc = Procedure(
            patient_id=patient_id,
            procedure_date=datetime.strptime(request.form["procedure_date"], "%Y-%m-%d").date() if request.form.get("procedure_date") else None,
            procedure_type=request.form.get("procedure_type"),
            side=request.form.get("side"),
            indication=request.form.get("indication"),
            stenosis_degree=float(request.form["stenosis_degree"]) if request.form.get("stenosis_degree") else None,
            symptomatic_status=request.form.get("symptomatic_status"),
        )
        db.session.add(proc)
        db.session.flush()

        # CEA details
        if proc.procedure_type == "CEA":
            cea = CEADetails(
                procedure_id=proc.procedure_id,
                anesthesia_type=request.form.get("anesthesia_type"),
                shunt_used="shunt_used" in request.form,
                patch_used="patch_used" in request.form,
                patch_type=request.form.get("patch_type"),
                clamp_time=int(request.form["clamp_time"]) if request.form.get("clamp_time") else None,
                closure_type=request.form.get("closure_type"),
                monitoring_type=request.form.get("monitoring_type"),
            )
            db.session.add(cea)

        # CAS details
        if proc.procedure_type == "CAS":
            cas = CASDetails(
                procedure_id=proc.procedure_id,
                access_site=request.form.get("access_site"),
                embolic_protection=request.form.get("embolic_protection"),
                stent_type=request.form.get("stent_type"),
                stent_diameter=float(request.form["stent_diameter"]) if request.form.get("stent_diameter") else None,
                stent_length=float(request.form["stent_length"]) if request.form.get("stent_length") else None,
                predilatation="predilatation" in request.form,
                postdilatation="postdilatation" in request.form,
            )
            db.session.add(cas)

        # Intraoperative events
        ie = IntraoperativeEvents(procedure_id=proc.procedure_id)
        for f in ["bradycardia", "hypotension", "embolization", "vessel_dissection",
                   "conversion_to_open", "technical_failure"]:
            setattr(ie, f, f in request.form)
        db.session.add(ie)

        # Complications
        comp = Complications(procedure_id=proc.procedure_id)
        comp.stroke = "comp_stroke" in request.form
        comp.stroke_type = request.form.get("comp_stroke_type")
        comp.tia = "comp_tia" in request.form
        comp.myocardial_infarction = "comp_mi" in request.form
        comp.death = "comp_death" in request.form
        comp.cranial_nerve_injury = "comp_cni" in request.form
        comp.hyperperfusion_syndrome = "comp_hps" in request.form
        comp.bleeding = "comp_bleeding" in request.form
        comp.infection = "comp_infection" in request.form
        db.session.add(comp)

        db.session.commit()
        flash("Procedure saved.", "success")
        return redirect(url_for("patient_view", patient_id=patient_id))
    return render_template("procedure_form.html", patient=p)


# ---- Follow-Up ------------------------------------------------------------

@app.route("/procedure/<int:procedure_id>/followup/new", methods=["GET", "POST"])
def followup_new(procedure_id):
    proc = Procedure.query.get_or_404(procedure_id)
    if request.method == "POST":
        fu = FollowUp(
            procedure_id=procedure_id,
            followup_date=datetime.strptime(request.form["followup_date"], "%Y-%m-%d").date() if request.form.get("followup_date") else None,
            followup_interval=request.form.get("followup_interval"),
            stroke="fu_stroke" in request.form,
            tia="fu_tia" in request.form,
            myocardial_infarction="fu_mi" in request.form,
            death="fu_death" in request.form,
            ipsilateral_stroke="fu_ipsi_stroke" in request.form,
            contralateral_stroke="fu_contra_stroke" in request.form,
            reintervention="fu_reintervention" in request.form,
        )
        db.session.add(fu)
        db.session.flush()

        # Restenosis
        rest = Restenosis(
            followup_id=fu.followup_id,
            restenosis_degree=float(request.form["rest_degree"]) if request.form.get("rest_degree") else None,
            peak_systolic_velocity=float(request.form["rest_psv"]) if request.form.get("rest_psv") else None,
            end_diastolic_velocity=float(request.form["rest_edv"]) if request.form.get("rest_edv") else None,
            ica_cca_ratio=float(request.form["rest_ratio"]) if request.form.get("rest_ratio") else None,
        )
        db.session.add(rest)

        # QoL
        qol = QualityOfLife(
            followup_id=fu.followup_id,
            eq5d_score=float(request.form["eq5d"]) if request.form.get("eq5d") else None,
            sf36_score=float(request.form["sf36"]) if request.form.get("sf36") else None,
        )
        db.session.add(qol)

        db.session.commit()
        flash("Follow-up saved.", "success")
        return redirect(url_for("patient_view", patient_id=proc.patient_id))
    return render_template("followup_form.html", procedure=proc)


# ---- Statistics / Analytics -----------------------------------------------

@app.route("/statistics")
def statistics():
    total_patients = Patient.query.count()
    if total_patients == 0:
        return render_template("statistics.html", stats=None, chart_data={})

    patients = Patient.query.all()
    procedures = Procedure.query.all()
    complications = Complications.query.all()

    ages = [p.age for p in patients if p.age is not None]
    mean_age = safe_mean(ages)
    male_count = sum(1 for p in patients if p.sex and p.sex.lower() in ("male", "m"))
    female_count = sum(1 for p in patients if p.sex and p.sex.lower() in ("female", "f"))

    cea_count = sum(1 for pr in procedures if pr.procedure_type == "CEA")
    cas_count = sum(1 for pr in procedures if pr.procedure_type == "CAS")
    total_procs = len(procedures)
    symptomatic_count = sum(1 for pr in procedures if pr.symptomatic_status and pr.symptomatic_status.lower() == "symptomatic")

    stroke_count = sum(1 for c in complications if c.stroke)
    mi_count = sum(1 for c in complications if c.myocardial_infarction)
    death_count = sum(1 for c in complications if c.death)
    tia_count = sum(1 for c in complications if c.tia)
    cni_count = sum(1 for c in complications if c.cranial_nerve_injury)

    def pct(num, denom):
        return round(num / denom * 100, 1) if denom else 0

    stats_data = {
        "total_patients": total_patients,
        "mean_age": mean_age,
        "male": male_count,
        "female": female_count,
        "total_procedures": total_procs,
        "cea": cea_count,
        "cas": cas_count,
        "symptomatic_rate": pct(symptomatic_count, total_procs),
        "stroke_rate": pct(stroke_count, total_procs),
        "mi_rate": pct(mi_count, total_procs),
        "mortality_rate": pct(death_count, total_procs),
        "tia_rate": pct(tia_count, total_procs),
        "cni_rate": pct(cni_count, total_procs),
    }

    # Prepare chart data as plain Python dicts (rendered as JSON in template)
    chart_data = {
        "sex": {"male": male_count, "female": female_count},
        "procedures": {"CEA": cea_count, "CAS": cas_count},
        "complications": {
            "Stroke": stroke_count, "TIA": tia_count,
            "MI": mi_count, "Death": death_count, "CN Injury": cni_count,
        },
    }

    # CEA vs CAS comparison
    if cea_count and cas_count:
        cea_proc_ids = {pr.procedure_id for pr in procedures if pr.procedure_type == "CEA"}
        cas_proc_ids = {pr.procedure_id for pr in procedures if pr.procedure_type == "CAS"}
        chart_data["cea_vs_cas"] = {
            "cea_stroke": pct(sum(1 for c in complications if c.procedure_id in cea_proc_ids and c.stroke), cea_count),
            "cas_stroke": pct(sum(1 for c in complications if c.procedure_id in cas_proc_ids and c.stroke), cas_count),
            "cea_death": pct(sum(1 for c in complications if c.procedure_id in cea_proc_ids and c.death), cea_count),
            "cas_death": pct(sum(1 for c in complications if c.procedure_id in cas_proc_ids and c.death), cas_count),
        }

    # Kaplan-Meier data (computed server-side, drawn client-side)
    followups = FollowUp.query.order_by(FollowUp.followup_date).all()
    if followups:
        events_list = []
        for fu in followups:
            proc = Procedure.query.get(fu.procedure_id)
            if proc and proc.procedure_date and fu.followup_date:
                days = (fu.followup_date - proc.procedure_date).days
                if days >= 0:
                    events_list.append({"time": days, "event": 1 if fu.stroke else 0})
        if events_list:
            # Compute KM curve: sort by time, compute survival at each event
            events_list.sort(key=lambda x: x["time"])
            n = len(events_list)
            km_points = [{"x": 0, "y": 1.0}]
            survived = 1.0
            at_risk = n
            for item in events_list:
                if item["event"]:
                    survived *= (at_risk - 1) / at_risk
                at_risk -= 1
                km_points.append({"x": item["time"], "y": round(survived, 4)})
            chart_data["km_survival"] = km_points

    # Restenosis data
    restenoses = Restenosis.query.all()
    degrees = [r.restenosis_degree for r in restenoses if r.restenosis_degree is not None]
    if degrees:
        # Bin into 10 buckets: 0-10, 10-20, ..., 90-100
        bins = [0] * 10
        for d in degrees:
            idx = min(int(d // 10), 9)
            bins[idx] += 1
        chart_data["restenosis"] = {
            "labels": [f"{i*10}-{i*10+10}%" for i in range(10)],
            "values": bins,
        }

    return render_template("statistics.html", stats=stats_data, chart_data=chart_data)


# ---- Data Export ----------------------------------------------------------

@app.route("/export/<fmt>")
def export_data(fmt):
    patients = Patient.query.all()
    rows = []
    all_keys = []

    for p in patients:
        row = {
            "patient_id": p.patient_id,
            "age": p.age,
            "sex": p.sex,
            "bmi": p.bmi,
            "smoking": p.smoking_status,
        }
        h = p.medical_history
        if h:
            for f in ["hypertension", "diabetes", "dyslipidemia", "coronary_artery_disease",
                       "previous_mi", "previous_stroke", "previous_tia",
                       "peripheral_arterial_disease", "atrial_fibrillation"]:
                row[f] = int(getattr(h, f, False) or False)

        for proc in p.procedures:
            proc_row = dict(row)
            proc_row["procedure_type"] = proc.procedure_type
            proc_row["procedure_date"] = str(proc.procedure_date) if proc.procedure_date else ""
            proc_row["side"] = proc.side
            proc_row["stenosis_degree"] = proc.stenosis_degree
            proc_row["symptomatic"] = proc.symptomatic_status

            c = proc.complications
            if c:
                proc_row["comp_stroke"] = int(c.stroke or False)
                proc_row["comp_tia"] = int(c.tia or False)
                proc_row["comp_mi"] = int(c.myocardial_infarction or False)
                proc_row["comp_death"] = int(c.death or False)

            rows.append(proc_row)

        if not p.procedures:
            rows.append(row)

    if not rows:
        flash("No data to export.", "warning")
        return redirect(url_for("index"))

    # Collect all column names in order
    seen = set()
    for r in rows:
        for k in r:
            if k not in seen:
                all_keys.append(k)
                seen.add(k)

    buf = io.BytesIO()

    if fmt in ("csv", "spss"):
        text_buf = io.StringIO()
        writer = csv.DictWriter(text_buf, fieldnames=all_keys, extrasaction="ignore")
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
        buf.write(text_buf.getvalue().encode("utf-8"))
        buf.seek(0)
        name = "carotid_registry_export.csv" if fmt == "csv" else "carotid_registry_spss.csv"
        return send_file(buf, mimetype="text/csv", as_attachment=True, download_name=name)

    elif fmt == "excel":
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Registry Data"
        ws.append(all_keys)
        for r in rows:
            ws.append([r.get(k, "") for k in all_keys])
        wb.save(buf)
        buf.seek(0)
        return send_file(buf,
                         mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                         as_attachment=True, download_name="carotid_registry_export.xlsx")

    else:
        flash("Unknown format.", "danger")
        return redirect(url_for("index"))


# ---- Search ---------------------------------------------------------------

@app.route("/search")
def search():
    q = request.args.get("q", "").strip()
    results = []
    if q:
        results = Patient.query.filter(
            db.or_(
                Patient.hospital_id.ilike(f"%{q}%"),
                Patient.patient_id == int(q) if q.isdigit() else False,
            )
        ).all()
    return render_template("search.html", results=results, query=q)


# ---------------------------------------------------------------------------
# INIT DB
# ---------------------------------------------------------------------------

with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(debug=True)
