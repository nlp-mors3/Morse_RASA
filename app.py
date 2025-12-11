from flask import Flask, render_template, request, jsonify, send_from_directory
from nlp_lib.doc_reader import cleanup_extracted_images as img_cleaner, get_content_sections as gcs
import os
import requests
from nlp_lib.gen_lex import IbaloiTranslator

# =============================
# INITIALIZATION
# =============================

app = Flask(
    __name__, 
    static_folder="static",
    template_folder="templates"
)

translator_service = IbaloiTranslator()

# =============================
# CLIENT PAGE ROUTES
# =============================

@app.route("/")
def home():
    img_cleaner(app.root_path)
    return render_template("index.html")

@app.route("/aboutus")
def about_us():
    img_cleaner(app.root_path)
    return render_template("AboutUs.html")

@app.route("/rasa-translator")
def rasa_translator():
    img_cleaner(app.root_path)
    return render_template("translation.html")

@app.route("/research-paper")
def research_paper():
    img_cleaner(app.root_path)
    return render_template("document.html")

@app.route("/documentation")
def documentation():
    img_cleaner(app.root_path)
    return render_template("document.html")

@app.route("/contactUs")
def contact():
    img_cleaner(app.root_path)
    return render_template("contact.html")

@app.route("/lexicon-browse")
def lexiconBrowse():
    img_cleaner(app.root_path)
    return render_template("lexicon browser.html")

@app.route("/builder")
def builder():
    img_cleaner(app.root_path)
    return render_template("builder.html")

@app.route("/footer")
def footer():
    img_cleaner(app.root_path)
    return render_template("footer.html")


# =============================
# ADMIN PAGE ROUTES
# =============================

@app.route("/dashboard")
def dashboard():
    img_cleaner(app.root_path)
    return render_template("dashboard.html")

# =============================
# ERROR HANDLER ROUTES
# =============================

@app.errorhandler(404)
def page_not_found(error):
    img_cleaner(app.root_path)
    return render_template("404.html"), 404

@app.errorhandler(403)
def forbidden(error):
    img_cleaner(app.root_path)
    return render_template("403.html"), 403

@app.errorhandler(500)
def server_error(error):
    img_cleaner(app.root_path)
    return render_template("500.html"), 500


# =============================
#  PREEMPTIVE / CUSTOM PAGES
# =============================

@app.route("/maintenance")
def maintenance():
    img_cleaner(app.root_path)
    return render_template("maintenance.html")

@app.route("/navbar")
def navbar():
    img_cleaner(app.root_path)
    return render_template("navbar.html")

@app.route("/lexicon")
def lexicon():
    data = []
    img_cleaner(app.root_path)
    return render_template("lexicon.html",data=data)

# =============================
#  FUNCTION ROUTES
# =============================

@app.route('/assets/extracted_images/<path:filename>')
def serve_extracted_image(filename):
    return send_from_directory(os.path.join(app.root_path, 'assets', 'extracted_images'), filename)

@app.route("/read-doc-content", methods=["POST"])
def get_sections():
    data = request.get_json()
    filepath = data.get('filepath')

    if not filepath:
        return jsonify({"error": "Missing filepath or document name"}), 400

    try:
        sections_data = gcs(filepath, root_dir=app.root_path)
        # sections_data = gcs()
        return jsonify(sections_data)
        
    except Exception as e:
        return jsonify({"error": f"An error occurred during processing: {str(e)}"}), 500

# =============================
# PROXY ROUTE
# =============================

GAS_URL =  "https://script.google.com/macros/s/AKfycbwDsmJEmfVwHGwNWSGEzOB-CMC2Bv1tCXntSJEhe8m1wyFWM7j5IhpwUfksKst0_6Vftw/exec"

@app.route("/proxy", methods=["GET", "POST", "OPTIONS"])
def proxy():
    response_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

    if request.method == "OPTIONS":
        return ("", 204, response_headers)

    try:
        if request.method == "GET":
            gas_response = requests.get(GAS_URL, params=request.args)
            return (gas_response.text, gas_response.status_code, response_headers)

        elif request.method == "POST":
            gas_response = requests.post(GAS_URL, json=request.json)
            return (gas_response.text, gas_response.status_code, response_headers)

        else:
            return ("Method Not Allowed", 405, response_headers)

    except Exception as e:
        return (jsonify({"error": str(e)}), 500, response_headers)
    
# =============================
# TRANSLATION API ROUTE
# =============================

@app.route("/api/translate", methods=["POST"])
def translate_ibaloi():
    """
    API Endpoint to handle Ibaloi translation requests.
    Expects JSON: { "text": "word or sentence" }
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' field in JSON payload"}), 400

        user_text = data['text']
        
        # Call the translator service
        result = translator_service.translate(user_text)
        
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

## Main Function
if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=8080,               
        debug=True               
    )