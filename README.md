# Morse_RASA
The frontend and backend impl of Chatbot that incorporates a customized Lexicon holding Ibaloi and English language

to install RASA:
in your VSC environment, or cmd, create a conda environment with this command:

`conda create -p ./.conda python=3.10 -y`

to run conda env
`conda activate ./.conda`

install necessary tools
`python -m pip install --upgrade pip setuptools wheel`

then the main thing
`pip install rasa`

## Application Setup

1.  **Clone this repository.**
2.  **Install Python Dependencies**:
    ```bash
    pip install flask requests python-docx
    ```
3.  **Run the Application**:
    ```bash
    python app.py
    ```
4.  **Open in Browser**:
    Go to [http://localhost:8080](http://localhost:8080) to start using the application.

## Notes

- The site does not call Google Apps Script directly
