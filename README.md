# ibaloiNLP : Preserving Ibaloi through Neural Processing

---

## Team Information

| Member Email            | Member Name              | Role          | 
| :---------------------- | :----------------------- | :-----------: | 
| ddmiguel@slu.edu.ph     | Miguel Dalos             | Advisor       | 
| 2227226@slu.edu.ph      | Xymond Louisse Alcazar   | Researcher    |
| 2195465@slu.edu.ph      | Rafael Lachica           | Researcher    |
| 2212637@slu.edu.ph      | Cheni Lei Olanos         | Researcher    |
| 2233059@slu.edu.ph      | Josiah Ezra Navarro      | Researcher    |
| 2225254@slu.edu.ph      | Prince John Louie Lucban | Researcher    |
| 2235110@slu.edu.ph      | John Henrich Collo       | Researcher    |
| 2214959@slu.edu.ph      | Ka Hang Christian Yuen   | Researcher    |

---

## Project Overview

**IBALOI NLP HUB**: Website hub consist of research paper for the digital collection process of ibaloi language, a crowdsourcing approach to collect ibaloi data and LexiconLM translation as our proof of usage.

**GitLab Repository**: [https://github.com/PerhapsYou/Morse_RASA]

---

## Research Paper Link

**CSE 30 Natural Language Processing**: [Google Docs Link](to be filled)

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://gitlab.com/2195465/ai-model.git
cd morse_rasa (https://github.com/PerhapsYou/Morse_RASA.git)
```

> You can also clone using the specific commit reference:
> ```bash
> git checkout this-is-a-placeholder
> ```

---

### 2. Create and Activate a Virtual Environment

MACOS
```bash
python -m venv venv
source venv/bin/activate
```
WINDOWS
```bash
python -m venv venv
venv\Scripts\activate
```

If Permission error occurred use this command for a quick fix

```bash
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

---

### 4. Gemini AI & .env file

1. Make a .env file in the root path
2. Visit https://aistudio.google.com/ then navigate at the bottom left and click `Get API Key` button and navigate the `Create API key`.
3. Copy the new created API and paste it inside the `.env file`

   ```bash
   GEMINI_API_KEY=replace_this_with_your_api_key
   ```

4. Your directory structure should be like this.

   ```
      project-root/
   ├── app.py
   ├── assets/
   ├── control/
   ├── nlp_lib/
   ├── pages/
   ├── static/
   ├── templates/
   ├── venv/
   │   └── ... (virtual environment files)
   ├── .env (contains your gemini credentials)
   ├── package.json
   ├── package-lock.json
   ├── proxy.js
   └── requirements.txt

   ```



---

### 5. Run the Application

```bash
python app.py
```

Open your browser and navigate to `http://localhost:5000` to access the chatbot interface.

---

## Preview

![Web-agent IMG Preview](Preview.png)
