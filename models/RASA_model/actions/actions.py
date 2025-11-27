import pandas as pd
from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

# Load the CSV once when the server starts
# Ensure your CSV headers match the code below
df = pd.read_csv('ibaloi_lexicon.csv')
df.fillna("N/A", inplace=True) # Handle empty fields

class ActionTranslateToIbaloi(Action):
    def name(self) -> Text:
        return "action_translate_to_ibaloi"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        # Get the entity detected by Rasa NLU
        query_word = tracker.get_slot('english_word')
        
        if not query_word:
            dispatcher.utter_message(text="I didn't catch the word you want to translate.")
            return []

        # Search the CSV (Case insensitive search)
        result = df[df['englishTranslation'].str.contains(query_word, case=False, na=False)]

        if not result.empty:
            # Get the first match
            row = result.iloc[0]
            word = row['word']
            pronunciation = row['Pronunciation']
            sentence = row['ibaloiSentence']
            
            response = f"The Ibaloi word for '{query_word}' is **{word}**."
            
            # Add richness using your extra columns
            if pronunciation != "N/A":
                response += f"\nPronunciation: *{pronunciation}*"
            if sentence != "N/A":
                response += f"\nExample: *{sentence}*"
                
            dispatcher.utter_message(text=response)
        else:
            dispatcher.utter_message(text=f"Sorry, I don't have a translation for '{query_word}' in my database yet.")

        return []