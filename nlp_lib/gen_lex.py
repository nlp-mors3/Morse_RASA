import csv
import re
import os
# REPLACE: Import Cerebras SDK instead of genai
from cerebras.cloud.sdk import Cerebras

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

        # REPLACE: Initialize Cerebras Client
        self.api_key = api_key or os.environ.get("CEREBRAS_API_KEY")
        self.client = None
        
        if self.api_key:
            try:
                self.client = Cerebras(api_key=self.api_key)
                self.model_name = "llama-3.3-70b" 
                print(f"Cerebras AI initialized with model: {self.model_name}")
            except Exception as e:
                print(f"Error initializing Cerebras AI: {e}")
        else:
            print("Warning: No CEREBRAS_API_KEY provided. AI refinement will be disabled.")

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
        tokens = [self.clean_token(t) for t in text.split()]
        ib_hits = sum(1 for t in tokens if t in self.ib_to_en)
        en_hits = sum(1 for t in tokens if t in self.en_to_ib)
        
        if en_hits > ib_hits:
            return 'en2ib'
        return 'ib2en'

    def translate(self, text):
        """
        Translates text using Lexicon lookup + Cerebras refinement.
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
            
            if not clean or clean in stopwords:
                translated_tokens.append(token) 
                continue

            if clean in lexicon:
                entry = lexicon[clean]
                target_word = entry['target']
                translated_tokens.append(target_word)
                
                breakdown_item = {
                    "word": token,
                    "meaning": target_word,
                    "pos": entry.get('POS', ''),
                    "notes": entry.get('Notes', '')
                }
                breakdown_data.append(breakdown_item)

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

        # Step 2: Refine with Cerebras AI
        final_translation = rough_translation 
        
        if self.client:
            final_translation = self.refine_with_cerebras(
                rough_translation, text, source_lang, target_lang, has_missing_words, context_block
            )

        return {
            "success": True,
            "original": text,
            "translation": final_translation,
            "breakdown": breakdown_data,
            "rough_translation": rough_translation,
            "direction": direction,
            "type": "ai_refined" if self.client else "lexicon_only"
        }

    def refine_with_cerebras(self, rough_text, original_input, source_lang, target_lang, has_missing_words, context_block):
        try:
            # Construct System Prompt (Stricter JSON/Format instructions)
            system_prompt = f"""
            You are an expert linguist specializing in the Ibaloi language (Northern Philippines) and English. 
            Your task is to translate the user's input from {source_lang} to {target_lang}.

            ### IMPORTANT OUTPUT RULES
            - Do NOT explain your reasoning.
            - Do NOT provide linguistic analysis.
            - Do NOT output "Okay, let's tackle this translation".
            - Output ONLY the final result as requested below.
            """

            # Construct User Prompt
            user_content = f"""
            ### CONTEXT
            1. Input: "{original_input}"
            2. Lexicon Hints: {rough_text}
            3. Metadata:
            {context_block}

            ### TASK
            """

            if has_missing_words:
                user_content += f"""
                Some words are missing. Based on context, provide the **TOP 5 most likely translations** in {target_lang}.
                
                Format your response strictly as a numbered list:
                1. [First translation]
                2. [Second translation]
                3. [Third translation]
                4. [Fourth translation]
                5. [Fifth translation]
                """
            else:
                user_content += f"""
                Create a single natural, grammatically correct sentence in {target_lang}.
                
                Format your response strictly as just the sentence string. No numbers, no quotes, no labels.
                """

            # Call Cerebras API
            response = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                model=self.model_name,
                temperature=0.3, # Lower temperature to reduce "chatty" behavior
                max_completion_tokens=300
            )

            # Post-processing: If the model still outputs thoughts (lines starting with numbers often indicate thoughts in some models), try to clean it
            content = response.choices[0].message.content.strip()
            
            # Simple heuristic cleaning if it still chats: get the last non-empty line
            if "\n" in content and not has_missing_words:
                lines = [line for line in content.split('\n') if line.strip()]
                # If the last line looks like a sentence, take it.
                return lines[-1]
            
            return content

        except Exception as e:
            print(f"Cerebras API Error: {e}")
            return f"{rough_text} (AI Error: Check console)"

if __name__ == "__main__":
    translator = IbaloiTranslator()