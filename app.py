from flask import Flask, render_template

app = Flask(
    __name__, 
    static_folder="static",
    template_folder="templates" 
)

# =============================
# CLIENT PAGE ROUTES
# =============================

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/rasa-translator")
def rasa_translator():
    return render_template("rasa.html")

# =============================
# ADMIN PAGE ROUTES
# =============================

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/translator")
def translator():
    return render_template("index.html")

# =============================
# ERROR HANDLER ROUTES
# =============================

@app.errorhandler(404)
def page_not_found(error):
    return render_template("404.html"), 404

@app.errorhandler(403)
def forbidden(error):
    return render_template("403.html"), 403

@app.errorhandler(500)
def server_error(error):
    return render_template("500.html"), 500


# =============================
#  PREEMPTIVE / CUSTOM PAGES
# =============================

@app.route("/maintenance")
def maintenance():
    return render_template("maintenance.html")






## Main Function
if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=8080,               
        debug=True               
    )
