# app/routes.py — service_notification/

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import aiosmtplib

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.database import get_db
from app.models import Notification, TypeNotification, CanalNotification, StatutNotification
from app.schemas import (
    NotificationEnvoyer, NotificationResponse,
    NotificationList, NotificationStats, MessageResponse
)
from app.dependencies import (
    get_current_user,
    get_current_admin,
    get_current_gestionnaire_or_admin,
    get_pagination
)
from app.config import settings

router = APIRouter()


# ═══════════════════════════════════════════════════════════
# FONCTION UTILITAIRE — Envoyer un email
# ═══════════════════════════════════════════════════════════

async def envoyer_email(
    destinataire : str,
    sujet        : str,
    contenu_html : str,
) -> tuple[bool, str | None]:
    """
    Envoie un email via SMTP asynchrone.
    Retourne (True, None) si succès, (False, message_erreur) si échec.
    """
    try:
        message = MIMEMultipart("alternative")
        message["From"]    = settings.SMTP_USER
        message["To"]      = destinataire
        message["Subject"] = sujet

        message.attach(MIMEText(contenu_html, "html", "utf-8"))

        await aiosmtplib.send(
            message,
            hostname = settings.SMTP_HOST,
            port     = settings.SMTP_PORT,
            username = settings.SMTP_USER,
            password = settings.SMTP_PASSWORD,
            start_tls= True,
        )
        return True, None
    except Exception as e:
        print("Erreur envoi email:", e)
        return False, str(e)


# ═══════════════════════════════════════════════════════════
# FONCTION UTILITAIRE — Générer le template email
# ═══════════════════════════════════════════════════════════

def generer_template_alerte(data: NotificationEnvoyer) -> tuple[str, str]:
    """
    Génère le sujet et le contenu HTML de l'email d'alerte.
    Retourne (sujet, contenu_html).
    """
    niveau_lower = (data.niveau or "").lower()
    icones = {
        "rupture"          : "🚨",
        "critique"         : "⚠️",
        "surstock"         : "📦",
        "expiration_proche": "📅",
    }
    icone = icones.get(niveau_lower, "🔔")

    sujet = f"{icone} Alerte Stock — {data.produit_nom or 'Produit'} — {data.niveau or 'alerte'}"

    contenu_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

        <div style="background-color: #0F1F3D; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">SGS SaaS — Alerte Stock</h1>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6;">

            <h2 style="color: #dc3545;">{icone} Alerte {data.niveau or ''}</h2>

            <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; font-weight: bold; width: 40%;">Produit</td>
                    <td style="padding: 10px;">{data.produit_nom or data.produit_id or 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; font-weight: bold;">Entrepôt</td>
                    <td style="padding: 10px;">{data.entrepot_nom or data.entrepot_id or 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; font-weight: bold;">Quantité actuelle</td>
                    <td style="padding: 10px; color: #dc3545; font-weight: bold;">
                        {data.quantite or 0} unités
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; font-weight: bold;">Message</td>
                    <td style="padding: 10px;">{data.message or 'Vérifiez le stock immédiatement'}</td>
                </tr>
            </table>

            {f'''
            <div style="margin-top: 20px; padding: 15px;
                        background-color: #EFF6FF; border-radius: 4px;
                        border-left: 4px solid #3B82F6;">
                <strong>🤖 Recommandation IA :</strong><br><br>
                {data.recommandation_ia}
            </div>
            ''' if data.recommandation_ia else ''}

            <div style="margin-top: 15px; padding: 15px;
                        background-color: #fff3cd; border-radius: 4px;">
                <strong>Action requise :</strong>
                Connectez-vous à l'application SGS SaaS pour traiter cette alerte.
            </div>

        </div>

        <div style="background-color: #6c757d; padding: 10px;
                    border-radius: 0 0 8px 8px; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">
                SGS SaaS — Système de Gestion de Stock
            </p>
        </div>

    </body>
    </html>
    """
    return sujet, contenu_html


def generer_template_expiration(data: NotificationEnvoyer) -> tuple[str, str]:
    """
    Génère le sujet et le contenu HTML pour une alerte d'expiration proche.
    Inclut la recommandation IA (promotion) directement dans l'email.
    """
    sujet = f"📅 Expiration proche — {data.produit_nom or 'Produit'} — Action requise"

    contenu_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

        <div style="background-color: #0F1F3D; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">SGS SaaS — Alerte Expiration</h1>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6;">

            <h2 style="color: #e67e22;">📅 Produit proche de sa date d'expiration</h2>

            <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; font-weight: bold; width: 40%;">Produit</td>
                    <td style="padding: 10px;">{data.produit_nom or data.produit_id or 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; font-weight: bold;">Entrepôt</td>
                    <td style="padding: 10px;">{data.entrepot_nom or data.entrepot_id or 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; font-weight: bold;">Quantité en stock</td>
                    <td style="padding: 10px; color: #e67e22; font-weight: bold;">
                        {data.quantite or 0} unités
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; font-weight: bold;">Détails</td>
                    <td style="padding: 10px;">{data.message or "Vérifiez la date d'expiration"}</td>
                </tr>
            </table>

            <div style="margin-top: 20px; padding: 15px;
                        background-color: #fff3cd; border-radius: 4px;
                        border-left: 4px solid #e67e22;">
                <strong>🤖 Recommandation IA :</strong><br><br>
                Ce produit arrive à expiration. Pour éviter les pertes, l'IA recommande
                de <strong>lancer une promotion commerciale</strong> afin d'écouler le stock
                avant la date limite. Actions possibles :
                <ul style="margin-top: 8px;">
                    <li>Appliquer une réduction tarifaire sur ce produit</li>
                    <li>Proposer un lot promotionnel avec d'autres articles</li>
                    <li>Alerter l'équipe commerciale pour accélérer les ventes</li>
                    <li>Envisager un don à des associations si le stock ne peut être écoulé</li>
                </ul>
            </div>

            <div style="margin-top: 15px; padding: 15px;
                        background-color: #d4edda; border-radius: 4px;">
                <strong>Action requise :</strong>
                Connectez-vous à l'application SGS SaaS pour traiter cette alerte
                et enregistrer l'action commerciale choisie.
            </div>

        </div>

        <div style="background-color: #6c757d; padding: 10px;
                    border-radius: 0 0 8px 8px; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">
                SGS SaaS — Système de Gestion de Stock
            </p>
        </div>

    </body>
    </html>
    """
    return sujet, contenu_html


def generer_template_anomalie(data: NotificationEnvoyer) -> tuple[str, str]:
    """
    Génère le sujet et le contenu HTML pour une notification d'anomalie
    envoyée à l'utilisateur qui a créé le mouvement suspect.
    """
    destinataire_nom = data.destinataire_nom or "Utilisateur"
    sujet = f"⚠️ Anomalie détectée sur votre mouvement — {data.produit_nom or 'Produit'}"

    contenu_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

        <div style="background-color: #0F1F3D; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">SGS SaaS — Anomalie détectée</h1>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6;">

            <p>Bonjour <strong>{destinataire_nom}</strong>,</p>
            <p>Une anomalie a été détectée sur un mouvement de stock que vous avez effectué.</p>

            <h2 style="color: #e67e22;">⚠️ Détails de l'anomalie</h2>

            <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; font-weight: bold; width: 40%;">Produit</td>
                    <td style="padding: 10px;">{data.produit_nom or data.produit_id or 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; font-weight: bold;">Entrepôt</td>
                    <td style="padding: 10px;">{data.entrepot_nom or data.entrepot_id or 'N/A'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; font-weight: bold;">Quantité</td>
                    <td style="padding: 10px;">{data.quantite or 0} unités</td>
                </tr>
                <tr>
                    <td style="padding: 10px; font-weight: bold;">Raison de l'anomalie</td>
                    <td style="padding: 10px; color: #dc3545;">{data.message or 'Anomalie détectée'}</td>
                </tr>
            </table>

            <div style="margin-top: 20px; padding: 15px;
                        background-color: #fdecea; border-radius: 4px; border-left: 4px solid #dc3545;">
                <strong>Action requise :</strong>
                Veuillez vérifier ce mouvement et le corriger si nécessaire.
                Si ce mouvement est intentionnel, contactez votre responsable.
            </div>

        </div>

        <div style="background-color: #6c757d; padding: 10px;
                    border-radius: 0 0 8px 8px; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">
                SGS SaaS — Système de Gestion de Stock
            </p>
        </div>

    </body>
    </html>
    """
    return sujet, contenu_html


# ═══════════════════════════════════════════════════════════
# ROUTES NOTIFICATION
# ═══════════════════════════════════════════════════════════

@router.post(
    "/notifications/envoyer",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,  # Endpoint interne — appelé par Service-Alertes uniquement
    summary="Envoyer une notification",
    description="Appelé par Service Alertes pour envoyer email/push aux responsables."
)
async def envoyer_notification(
    data        : NotificationEnvoyer,
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    # Choisir le bon template selon le type de notification
    if data.niveau and data.niveau.upper() == "EXPIRATION_PROCHE":
        sujet, contenu_html = generer_template_expiration(data)
    elif data.destinataire_email:
        # Email spécifique fourni → notification d'anomalie vers l'utilisateur concerné
        sujet, contenu_html = generer_template_anomalie(data)
    else:
        sujet, contenu_html = generer_template_alerte(data)

    # Utiliser l'email spécifique si fourni, sinon email par défaut (SMTP_USER)
    destinataire_email = data.destinataire_email or settings.SMTP_USER

    notification = Notification(
        type_notification  = data.type,
        canal              = CanalNotification.EMAIL,
        statut             = StatutNotification.EN_ATTENTE,
        destinataire_email = destinataire_email,
        sujet              = sujet,
        contenu            = data.message or sujet,
        contenu_html       = contenu_html,
        alerte_id          = data.alerte_id,
        niveau_alerte      = data.niveau,
        produit_id         = data.produit_id,
        produit_nom        = data.produit_nom,
        entrepot_id        = data.entrepot_id,
        entrepot_nom       = data.entrepot_nom,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    succes, erreur = await envoyer_email(
        destinataire = destinataire_email,
        sujet        = sujet,
        contenu_html = contenu_html,
    )

    if succes:
        notification.statut    = StatutNotification.ENVOYEE
        notification.envoye_le = datetime.now()
    else:
        notification.statut         = StatutNotification.ECHEC
        notification.erreur_message = f"Échec envoi SMTP : {erreur}"

    db.commit()
    db.refresh(notification)
    return notification


@router.get(
    "/notifications",
    response_model=NotificationList,
    summary="Lister les notifications",
)
async def lister_notifications(
    statut      : Optional[str] = Query(None),
    canal       : Optional[str] = Query(None),
    produit_id  : Optional[int] = Query(None),
    entrepot_id : Optional[int] = Query(None),
    db          : Session       = Depends(get_db),
    current_user: dict          = Depends(get_current_gestionnaire_or_admin),
    pagination  : dict          = Depends(get_pagination)
):
    query = db.query(Notification)

    if statut:
        query = query.filter(Notification.statut == statut)
    if canal:
        query = query.filter(Notification.canal == canal)
    if produit_id:
        query = query.filter(Notification.produit_id == produit_id)
    if entrepot_id:
        query = query.filter(Notification.entrepot_id == entrepot_id)

    total = query.count()
    notifications = (
        query
        .order_by(Notification.created_at.desc())
        .offset(pagination["skip"])
        .limit(pagination["limit"])
        .all()
    )
    return NotificationList(
        total         = total,
        page          = pagination["page"],
        per_page      = pagination["per_page"],
        notifications = notifications
    )


@router.get(
    "/notifications/stats",
    response_model=NotificationStats,
    summary="Statistiques des notifications",
)
async def stats_notifications(
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_gestionnaire_or_admin),
):
    return NotificationStats(
        total_envoyees   = db.query(Notification).filter(
            Notification.statut == StatutNotification.ENVOYEE).count(),
        total_echecs     = db.query(Notification).filter(
            Notification.statut == StatutNotification.ECHEC).count(),
        total_en_attente = db.query(Notification).filter(
            Notification.statut == StatutNotification.EN_ATTENTE).count(),
        total_email      = db.query(Notification).filter(
            Notification.canal == CanalNotification.EMAIL).count(),
        total_push       = db.query(Notification).filter(
            Notification.canal == CanalNotification.PUSH).count(),
        total_web        = db.query(Notification).filter(
            Notification.canal == CanalNotification.WEB).count(),
    )


# ═══════════════════════════════════════════════════════════
# ROUTES ADMIN UNIQUEMENT
# IMPORTANT : doit être définie AVANT /{notification_id}
# sinon FastAPI capture "echecs" comme un entier → 422
# ═══════════════════════════════════════════════════════════

@router.get(
    "/notifications/echecs",
    response_model=NotificationList,
    summary="Notifications en échec",
    description="Liste toutes les notifications échouées. Réservé à Admin uniquement."
)
async def notifications_echecs(
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_admin),
    pagination  : dict    = Depends(get_pagination)
):
    query = db.query(Notification).filter(
        Notification.statut == StatutNotification.ECHEC
    ).order_by(Notification.created_at.desc())

    total         = query.count()
    notifications = query.offset(pagination["skip"]).limit(pagination["limit"]).all()

    return NotificationList(
        total         = total,
        page          = pagination["page"],
        per_page      = pagination["per_page"],
        notifications = notifications
    )


@router.post(
    "/notifications/{notification_id}/renvoyer",
    response_model=NotificationResponse,
    summary="Renvoyer une notification échouée",
    description="Retente l'envoi d'une notification en échec. Réservé à Admin."
)
async def renvoyer_notification(
    notification_id: int,
    db             : Session = Depends(get_db),
    current_user   : dict    = Depends(get_current_admin),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification {notification_id} introuvable"
        )
    if notification.statut != StatutNotification.ECHEC:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seules les notifications en échec peuvent être renvoyées"
        )

    succes, erreur = await envoyer_email(
        destinataire = notification.destinataire_email,
        sujet        = notification.sujet,
        contenu_html = notification.contenu_html or notification.contenu,
    )

    if succes:
        notification.statut         = StatutNotification.ENVOYEE
        notification.envoye_le      = datetime.now()
        notification.erreur_message = None
    else:
        notification.erreur_message = f"Échec envoi SMTP : {erreur}"

    db.commit()
    db.refresh(notification)
    return notification


@router.get(
    "/notifications/{notification_id}",
    response_model=NotificationResponse,
    summary="Détail d'une notification",
)
async def get_notification(
    notification_id: int,
    db             : Session = Depends(get_db),
    current_user   : dict    = Depends(get_current_gestionnaire_or_admin),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id
    ).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification {notification_id} introuvable"
        )
    return notification