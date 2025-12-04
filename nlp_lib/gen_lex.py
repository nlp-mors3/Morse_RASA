import csv
import re
import os
import google.generativeai as genai

class IbaloiTranslator:
    def __init__(self, csv_path='nlp_lib/FINAL-Ibaloi_LexiconWordCollection - Main Lexicon.csv', api_key=None):
        self.en_to_ib = {}
        self.ib_to_en = {}
        
        # Configuration
        self.ENGLISH_STOPWORDS = {
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
            'to', 'of', 'in', 'for', 'with', 'by'
        }
        self.IBALOI_STOPWORDS = set()

        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash-preview-09-2025')
        else:
            print("Warning: No GEMINI_API_KEY provided. AI refinement will be disabled.")
            self.model = None

        # Load Data
        self.load_lexicon(csv_path)

    def load_lexicon(self, path):
        """
        Loads CSV data into two dictionaries for bidirectional lookup.
        """
        if not os.path.exists(path):
            print(f"⚠️ Warning: Lexicon file '{path}' not found. Using empty lexicon.")
            return

        try:
            with open(path, mode='r', encoding='utf-8-sig') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    ibaloi_raw = row.get('Ibaloi_word', '').strip()
                    english_raw = row.get('English_word', '').strip().lower()

                    context_data = {}
                    if row.get('POS', '').strip(): context_data['POS'] = row['POS'].strip()
                    if row.get('Ibaloi_synonyms', '').strip(): context_data['Synonyms'] = row['Ibaloi_synonyms'].strip()
                    if row.get('Ibaloi_sentence', '').strip(): context_data['Ibaloi_Example'] = row['Ibaloi_sentence'].strip()
                    if row.get('English_sentence', '').strip(): context_data['English_Example'] = row['English_sentence'].strip()
                    if row.get('Notes', '').strip(): context_data['Notes'] = row['Notes'].strip()

                    if ibaloi_raw and english_raw:
                        # English -> Ibaloi
                        english_variants = [w.strip() for w in english_raw.split(',')]
                        for eng_variant in english_variants:
                            self.en_to_ib[eng_variant] = {'target': ibaloi_raw, **context_data}

                        # Ibaloi -> English
                        self.ib_to_en[ibaloi_raw.lower()] = {'target': english_raw, **context_data}
            
            print("Lexicon loaded successfully.")
        except Exception as e:
            print(f"Error loading CSV: {e}")

    def clean_token(self, token):
        """Removes punctuation from edges of words."""
        return re.sub(r'[^\w\s-]', '', token).lower()

    def detect_direction(self, text):
        """
        Simple heuristic to detect direction. 
        Checks which lexicon has more hits for the input words.
        Defaults to 'ib2en' (Ibaloi -> English).
        """
        tokens = [self.clean_token(t) for t in text.split()]
        ib_hits = sum(1 for t in tokens if t in self.ib_to_en)
        en_hits = sum(1 for t in tokens if t in self.en_to_ib)
        
        if en_hits > ib_hits:
            return 'en2ib'
        return 'ib2en'

    def translate(self, text):
        """
        Translates text using Lexicon lookup + Gemini refinement.
        Returns a dictionary compatible with the Flask app.
        """
        if not text:
            return {"error": "No text provided", "success": False}

        direction = self.detect_direction(text)
        
        # Configure based on direction
        if direction == 'en2ib':
            stopwords = self.ENGLISH_STOPWORDS
            lexicon = self.en_to_ib
            source_lang, target_lang = "English", "Ibaloi"
        else:
            stopwords = self.IBALOI_STOPWORDS
            lexicon = self.ib_to_en
            source_lang, target_lang = "Ibaloi", "English"

        # Step 1: Tokenize & Lookup
        raw_tokens = text.split()
        translated_tokens = []
        breakdown_data = []
        found_context_strings = []
        has_missing_words = False

        for token in raw_tokens:
            clean = self.clean_token(token)
            
            # Skip empty or stopwords for lookup, but keep in structure if needed
            if not clean or clean in stopwords:
                # Just append original for flow, but mark as skipped in breakdown if desired
                translated_tokens.append(token) 
                continue

            if clean in lexicon:
                entry = lexicon[clean]
                target_word = entry['target']
                translated_tokens.append(target_word)
                
                # Add to breakdown list for frontend
                breakdown_item = {
                    "word": token,
                    "meaning": target_word,
                    "pos": entry.get('POS', ''),
                    "notes": entry.get('Notes', '')
                }
                breakdown_data.append(breakdown_item)

                # Prepare context for LLM
                details = [f"Mapped to: '{target_word}'"]
                if 'POS' in entry: details.append(f"POS: {entry['POS']}")
                if 'Ibaloi_Example' in entry: details.append(f"Ex(IB): {entry['Ibaloi_Example']}")
                if 'English_Example' in entry: details.append(f"Ex(EN): {entry['English_Example']}")
                if 'Notes' in entry: details.append(f"Notes: {entry['Notes']}")

                
                found_context_strings.append(f"- Input '{clean}': {'; '.join(details)}")
            else:
                translated_tokens.append(f"[{clean}]")
                breakdown_data.append({"word": token, "meaning": "???"})
                has_missing_words = True

        rough_translation = " ".join(translated_tokens)
        context_block = "\n".join(found_context_strings)

        # Step 2: Refine with Gemini
        final_translation = rough_translation # Default to rough if LLM fails/missing
        
        if self.model:
            final_translation = self.refine_with_gemini(
                rough_translation, text, source_lang, target_lang, has_missing_words, context_block
            )

        return {
            "success": True,
            "original": text,
            "translation": final_translation,
            "breakdown": breakdown_data,
            "rough_translation": rough_translation,
            "direction": direction,
            "type": "ai_refined" if self.model else "lexicon_only"
        }

    def refine_with_gemini(self, rough_text, original_input, source_lang, target_lang, has_missing_words, context_block):
        try:
            base_prompt = f"""
            I am translating from {source_lang} to {target_lang}.

            Original Input: "{original_input}"
            Rough Word-for-Word Lookups: "{rough_text}"

            === DETAILED CONTEXT FROM LEXICON ===
            Use this data to choose the correct grammatical form or understand the meaning:
            {context_block}
            =====================================
            """

            if has_missing_words:
                prompt = base_prompt + f"""

                NOTE: Some words were missing from the lexicon (indicated by brackets []).

                Task:
                1. Analyze the context of the Original Input to infer the missing words.
                2. Using the "Detailed Context" provided above, ensure the known words are used correctly (e.g. check Example sentences for usage patterns).
                3. Provide the **TOP 5 most likely translations** for the entire sentence in {target_lang}.

                Output strictly a numbered list (1 to 5) of the translated sentences. Do not add introductory text.
                """
            else:
                prompt = base_prompt + f"""

                Task:
                1. Create a single natural, grammatically correct sentence in {target_lang}.
                2. Use the "Detailed Context" provided above to ensure accurate usage (pay attention to POS and Examples).

                Output only the final corrected {target_lang} sentence.
                """

            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            return f"{rough_text} (AI Error: {str(e)})"

if __name__ == "__main__":

    translator = IbaloiTranslator()