import gensim.downloader as api
import sys
import json

print("Loading Word2Vec model... (this may take a few minutes the first time)")
model = api.load('word2vec-google-news-300')
print("Model loaded successfully!")


#Top similar words
"""
similar = model.most_similar('mongrel', topn=5)
for word, score in similar:
    print(f"  {word}: {score:.3f}")
"""

#Similarity between words
"""
pairs = [
    ("king", "queen"),
    ("man", "woman"),
    ("paris", "france"),
    ("dog", "cat"),
    ("car", "bicycle"),
    ("apple", "computer")
]

for word1, word2 in pairs:
    if word1 in model and word2 in model:
        similarity = model.similarity(word1, word2)
        print(f"  '{word1}' vs '{word2}': {similarity:.3f}")
    else:
        print(f"  '{word1}' vs '{word2}': One or both words not in vocabulary")
"""

#Interactive most similar words
"""
while True:
    word = input("Enter a word to find similar words: ").strip().lower()
    if word == 'quit':
        break
    
    if word in model:
        similar = model.most_similar(word, topn=3)
        print(f"Words similar to '{word}':")
        for sim_word, score in similar:
            print(f"  {sim_word}: {score:.3f}")
    else:
        print(f"'{word}' not found in vocabulary")
    print()
"""

while True:
    user_input = input("\n> ").strip()
    
    if user_input.lower() == 'quit':
        break
    
    words = user_input.split()
    
    if len(words) != 2:
        print("Please enter exactly two words separated by space")
        continue
    
    word1, word2 = words[0].lower(), words[1].lower()
    
    # Check if both words exist in vocabulary
    if word1 not in model:
        print(f"'{word1}' does not exist in vocabulary, try again")
        continue
    
    if word2 not in model:
        print(f"'{word2}' does not exist in vocabulary, try again")
        continue
    
    # Calculate and display similarity
    similarity = model.similarity(word1, word2)
    print(f"Similarity between '{word1}' and '{word2}': {similarity:.3f}")