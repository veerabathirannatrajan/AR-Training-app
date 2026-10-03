"""PDF documents: certificates (with verification QR) and compliance reports (reportlab)."""

import io
from datetime import datetime
from urllib.parse import quote

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.content import module_title
from app.models import Certificate
from app.signing import CERT_FORMAT_VERSION, b64url

VERIFY_URL_BASE = "https://ar-mining-training.vercel.app/#c="
ACCENT = colors.HexColor("#ff7a1a")
INK = colors.HexColor("#101828")
MUTED = colors.HexColor("#475467")
LINE = colors.HexColor("#e4e7ec")
FOOTER = "Mines Act 1952 · Factories Act 1948 · DGMS compliance"


def _latin(text: str) -> str:
    """The built-in PDF fonts use the Windows-1252 character set (no Devanagari)."""
    return text.encode("cp1252", "replace").decode("cp1252")


def certificate_qr_text(cert: Certificate) -> str:
    """Same format as encodeCertificateQr in packages/shared/src/certificates.ts."""
    fields = [
        str(CERT_FORMAT_VERSION),
        cert.id,
        cert.worker_id,
        quote(cert.worker_name, safe="-_.!~*'()"),
        cert.module_id,
        str(cert.score),
        cert.issued_on.replace("-", ""),
        cert.expires_on.replace("-", ""),
        cert.key_id,
        b64url(bytes.fromhex(cert.hash)),
        cert.signature,
    ]
    return VERIFY_URL_BASE + "~".join(fields)


def _qr(canvas: Canvas, text: str, x: float, y: float, size: float) -> None:
    widget = QrCodeWidget(text, barLevel="M")
    x0, y0, x1, y1 = widget.getBounds()
    drawing = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, canvas, x, y)


def _date(day: str) -> str:
    year, month, date = day.split("-")
    return f"{date}-{month}-{year}"


def certificate_pdf(cert: Certificate, state: str) -> bytes:
    buffer = io.BytesIO()
    width, height = landscape(A4)
    pdf = Canvas(buffer, pagesize=(width, height))
    pdf.setTitle(f"{cert.id} – {cert.worker_name}")
    pdf.setAuthor("AR Mining Training App")

    # Frame
    pdf.setStrokeColor(ACCENT)
    pdf.setLineWidth(3)
    pdf.roundRect(18, 18, width - 36, height - 36, 14)
    pdf.setStrokeColor(LINE)
    pdf.setLineWidth(1)
    pdf.roundRect(28, 28, width - 56, height - 56, 10)

    title = module_title(cert.module_id)
    worker = cert.worker
    pdf.setFillColor(ACCENT)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawCentredString(width / 2, height - 72, "AR MINING TRAINING APP")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 30)
    pdf.drawCentredString(width / 2, height - 112, "Certificate of Safety Training")
    pdf.setFont("Helvetica", 13)
    pdf.setFillColor(MUTED)
    pdf.drawCentredString(width / 2, height - 150, "This certifies that")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 26)
    pdf.drawCentredString(width / 2, height - 184, _latin(cert.worker_name))
    pdf.setFont("Helvetica", 11.5)
    pdf.setFillColor(MUTED)
    pdf.drawCentredString(
        width / 2,
        height - 206,
        _latin(f"Worker ID {cert.worker_id} · {worker.role} · {worker.site.name}, {worker.site.district}"),
    )
    pdf.setFont("Helvetica", 13)
    pdf.drawCentredString(width / 2, height - 236, "has passed the assessed AR safety training module")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawCentredString(width / 2, height - 264, _latin(title.get("en", cert.module_id)))
    pdf.setFont("Helvetica", 13)
    pdf.setFillColor(MUTED)
    pdf.drawCentredString(
        width / 2, height - 286,
        f"with a score of {cert.score}% (60% practical AR actions + 40% scenario quiz)",
    )

    # Details (left) and QR (right)
    rows = [
        ("Certificate ID", cert.id),
        ("Issued on", _date(cert.issued_on)),
        ("Valid until", _date(cert.expires_on)),
        ("Status", state.capitalize()),
        ("Signature", f"Ed25519 · key {cert.key_id}"),
        ("SHA-256", cert.hash[:32]),
        ("", cert.hash[32:]),
        (
            "Polygon Amoy",
            f"Tx {cert.anchor_tx_hash[:10]}…{cert.anchor_tx_hash[-6:]}"
            if cert.anchor_tx_hash and cert.anchor_status == "anchored"
            else "Not anchored yet",
        ),
    ]
    y = 220
    for label, value in rows:
        pdf.setFont("Helvetica", 10)
        pdf.setFillColor(MUTED)
        pdf.drawString(70, y, label)
        pdf.setFillColor(INK)
        pdf.setFont("Courier" if label in ("SHA-256", "") else "Helvetica-Bold", 10)
        pdf.drawString(170, y, value)
        y -= 17

    qr_size = 150
    _qr(pdf, certificate_qr_text(cert), width - 70 - qr_size, 66, qr_size)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.setFillColor(INK)
    pdf.drawCentredString(width - 70 - qr_size / 2, 56, "Scan to verify")
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(MUTED)
    pdf.drawCentredString(width - 70 - qr_size / 2, 45, "Works offline in the AR Mining Training app")

    pdf.setFont("Helvetica", 8.5)
    pdf.drawString(70, 45, FOOTER)

    if state in ("revoked", "expired"):
        pdf.saveState()
        pdf.setFillColor(colors.Color(0.86, 0.15, 0.15, alpha=0.18))
        pdf.setFont("Helvetica-Bold", 110)
        pdf.translate(width / 2, height / 2)
        pdf.rotate(22)
        pdf.drawCentredString(0, -30, state.upper())
        pdf.restoreState()

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


# ---- Compliance report ------------------------------------------------------------------------


def _table(data: list[list[str]], widths: list[float], align_right: tuple[int, ...] = ()) -> Table:
    table = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8.5),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 8.5),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("TEXTCOLOR", (0, 1), (-1, -1), INK),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, LINE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for column in align_right:
        style.append(("ALIGN", (column, 0), (column, -1), "RIGHT"))
    table.setStyle(TableStyle(style))
    return table


def compliance_pdf(
    *,
    filters: str,
    generated_at: datetime,
    kpis: list[tuple[str, str]],
    sites: list[list[str]],
    modules: list[list[str]],
    workers: list[list[str]],
    module_columns: list[str],
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm,
        bottomMargin=18 * mm, title="Training Compliance Report", author="AR Mining Training App",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], fontSize=18, alignment=0, textColor=INK, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=12, textColor=INK, spaceBefore=10, spaceAfter=6)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=MUTED)

    story = [
        Paragraph("Training Compliance Report", h1),
        Paragraph(_latin(f"AR Mining Training App · {filters} · generated "
                         f"{generated_at.strftime('%d-%m-%Y %H:%M')} UTC"), small),
        Spacer(1, 10),
    ]
    kpi_table = Table(
        [[label for label, _ in kpis], [value for _, value in kpis]],
        colWidths=[(A4[0] - 32 * mm) / len(kpis)] * len(kpis),
    )
    kpi_table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica", 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("FONT", (0, 1), (-1, 1), "Helvetica-Bold", 16),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
    ]))
    story += [kpi_table, Paragraph("Site compliance", h2)]
    story.append(_table(
        [["Site", "District", "Sector", "Workers", "Certified", "Compliance", "Avg. score"], *sites],
        [52 * mm, 26 * mm, 18 * mm, 18 * mm, 20 * mm, 22 * mm, 22 * mm], (3, 4, 5, 6),
    ))
    story.append(Paragraph("Module results", h2))
    story.append(_table(
        [["Module", "Assessments", "Pass rate", "Avg. score", "Certified workers"], *modules],
        [64 * mm, 26 * mm, 24 * mm, 24 * mm, 40 * mm], (1, 2, 3, 4),
    ))
    story.append(Paragraph("Worker certification register", h2))
    module_width = 30 * mm
    story.append(_table(
        [["ID", "Name", "Site", *module_columns, "Avg.", "Last activity"],
         *[[_latin(cell) for cell in row] for row in workers]],
        [13 * mm, 38 * mm, 24 * mm, *[module_width] * len(module_columns), 12 * mm, 22 * mm],
        (3 + len(module_columns),),
    ))

    def footer(canvas: Canvas, document: SimpleDocTemplate) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(16 * mm, 10 * mm, FOOTER)
        canvas.drawRightString(A4[0] - 16 * mm, 10 * mm, f"Page {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
