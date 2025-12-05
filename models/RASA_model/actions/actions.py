import pandas as pd
from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

#import for the json request
import requests

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
    
    # --- Custom RAG Fallback Action ---
class ActionRAGCall(Action):
    def name(self) -> str:
        return "action_rag_call"

    async def run(self,
                  dispatcher: CollectingDispatcher,
                  tracker: Tracker,
                  domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        #fix this code to get user message from 
        user_message = tracker.latest_message.get("text", "").strip().lower()
        try:

            rag_url = "http://rag_server:8000/predict"
            response = requests.post(
                rag_url,
                json={"query": user_message, 
                }
            )

            # Get the full answer from the response as a JSON object
            if response.status_code == 200:  # Check if the request was successful
                response_json = response.json()
                full_answer = response_json.get("text", "") 

                # Send the full answer as a message
                dispatcher.utter_message(text=full_answer)
            else:
                # Handle error case
                dispatcher.utter_message(text="Sorry, there was an issue processing your request.")

        except requests.exceptions.RequestException as e:
            dispatcher.utter_message(text=f"Error connecting to RAG service: {str(e)}")

        return 
