**Prompt gen matrix spec:**

\===================================================================================

Goal:  
Create a framework to generate MASTER prompts.  
MASTER prompts generate actual runnable prompts  
prompts could be Straight prompts, Seq prompts etc.  
The prompts will be structured so that the LLM will understand and produce the right generated prompts

\===================================================================================

**Todo:**

* Create a excel like matrix that encompasses all possible combination of items, ideas  
* ideas are in columns   
* Matrix sheet can have any no of columns  
* Each column can have any no of values  
*   
* Add/mod/del a column the code should work  
* Add/mod/del a row in a column code should work  
* Config file or files that will drive the whole process  
* Config file can have steps with \<variables\> (\<\> are the identifiers for the variables). Variables will be substituted from column names with values  
* By modifying the config file the output changes  
* config contains name=Y/N to specify whether a column will be used or not  
* name=value (value can be static set, range, 1 value)  
* config contains steps like   
  * step1: do x using \<var1\>  
  * step2: do y using \<var2\>  
  * step3: combine step1 and step2  
  * step4: create a \<var3\> output

**options 01: (use a any and all of)**

1. People (1 or more)  
2. Things (1 or more)  
3. Animals (1 or more)  
4. Birds (1 or more)  
5. Places (1 or more)  
6. Emotions (1 or more)  
7. Actions (1 or more)  
8. Events (1 or more)  
9. Scenarios (1 or more)  
10. Accessories (1 or more) \- Example hair do, sunglass, outfit…  
11. others

**Prompt/data structure Output details:**

1. Output Type (1 or more) \- like Text/image/..  
2. Output Size (1 or more) \- 10-15 words/1000 words…  
3. Output format \- like vertical/wide screen etc

**Sequence specific stuff:**

1. Plain Seq  
2. seq with text transition  
3. seq with puzzles transition  
4. 

| sequence | (same person/thing/animal/bird), reaching a goal |  |
| :---- | :---- | :---- |
|  | **Example1 sequence below** | **Example 2 below** |
|  | A person studying for exams steps: | Obese: (same person), reaching a goal |
|  | writing goals | Obese, upset/sad/low energy \>\>\>\>\>\> lean thin, happy, energetic. Steps below |
|  | collect materials & organizing | 1\. Obese, upset/sad/low energy (obese man) |
|  | study, rest | 2\. writing goals (obese man) |
|  | study, take sample tests | 3\. shopping groceries (veggies, health food) (less obese man) |
|  | reflect from notes | 4\. Exercise (still less obese man) |
|  | catch up step | 5\. Socialize, jog/walk.... (still less obese man) |
|  | fully prepared | 6\. more exercise (lean and thin man) |
|  |  | 7\. going thru goals (happy, smiling, dedicated) |
|  |  | 8\. lean, thin, happy (very thin, 3 pack man) |

**Image specific stuff:**

1. camera model  
2. composition  
3. lighting  
4. etc

**Video specific stuff:**

**Rules/Steps/Sub steps:**  
define overall purpose  
define the person/thing/main character(s)  
	https://docs.google.com/spreadsheets/d/1TxClUXkh16U20wBG4QmLZcotWLnEoO4LGgvIcLYcO3w  
define the scenario (ex: river bank, kitchen..)  
define the tweaks on the main character(s)  
define problem domain, sub domain (ex: health)  
define the problem (man angry)  
define emotions (Very happy…)  
define Action (Man about to hit dog)  
define the solution  
define content requirements  
define output medium requirements  
define output structure requirements  
define output requirements  
...  
...

**Output:**  
multi step prompts

Approach:  
Create the excel like structure 

**Final output from the new process**  
**Master prompt requirements: (should be able to gen)**

1. Text  
2. Formatted text (html, json…)  
3. Image  
4. Image with content  
5. Seq image  
6. Seq text  
7. Videos  
8. Audio  
9. Presentation

\===================================================================================

Exercise:

Veggies  
Tomato:  
properties  
Nutrients (vitamins, minerals)  
benefits  
Way of eating (raw, different way of cooking..)  
Way of cooking  
....  
....

100 \- 150 words (mobile format) \- words  
15-40 words \- Image prompts

in a placard write "Tomatoes are rich in lycopene, a powerful antioxidant linked to reduced risk of heart disease and certain cancers. They also provide vitamins C and K, potassium, and folate, contributing to overall health."

in a large poster board write "Tomatoes are rich in lycopene, a powerful antioxidant linked to reduced risk of heart disease and certain cancers. They also provide vitamins C and K, potassium, and folate, contributing to overall health."

Very happy woman holding a large poster board with writen words "Tomatoes are rich in lycopene, a powerful antioxidant linked to reduced risk of heart disease and certain cancers. They also provide vitamins C and K, potassium, and folate, contributing to overall health."

Very angry ogre holding a large poster board with writen words "Tomatoes are rich in lycopene, a powerful antioxidant linked to reduced risk of heart disease and certain cancers. They also provide vitamins C and K, potassium, and folate, contributing to overall health."

Very happy fantasy charectors holding a large poster board with writen words "Tomatoes are rich in lycopene, a powerful antioxidant linked to reduced risk of heart disease and certain cancers. They also provide vitamins C and K, potassium, and folate, contributing to overall health."

Very happy puppy in the top corner, a large poster board in front with written words "Tomatoes are rich in lycopene, a powerful antioxidant linked to reduced risk of heart disease and certain cancers. They also provide vitamins C and K, potassium, and folate, contributing to overall health."

Very happy puppy peeking behind a large poster board in front with written words "Tomatoes are rich in lycopene, a powerful antioxidant linked to reduced risk of heart disease and certain cancers. They also provide vitamins C and K, potassium, and folate, contributing to overall health."

Writing medium:  
paper  
slate  
placard  
poster board  
plain board  
Plain wood  
Metal  
plain cloth

Emotions: happy/angry

Somebody:  
young man/young woman/man/woman/old man, old woman  
animals/birds  
fantasy charectors

Where this somebody is positioned:  
holding  
standing behind  
in a corner (tl,tr,top,bl,bottom,br)

\==================================================================================================

Image prompts indicating health benefits of veggies  
type of veggie  
no of words

Things (All like mountains,rivers, tables....)

People  
Animals/Birds/...  
Fantasy creatures  
Charectors

Emotions (state)

Expressions (Gestures)

Foreground  
Background

Colors

Quirks(hat, sunglass, hair do, jewelery, dress..)

Medium (poster board, paper, slate...)

What's happening: to do  
(generated content)

Tone: funny/scientific/motivational....  
no of words: range, static value  
content\_type: bullets, paragraphs

Others: font

Fillers

Ideas:  
Config: (name=value)  
y/n flags to select or delect matrix columns  
randomness: random/range/given

Steps \- order can be changed  
line no: step=do x : Y  
line no: step=do y : Y  
line no: step=do z : N

\==================================================================================================

**List of projects**

[https://docs.google.com/document/d/1icOn6daEiFUF8x94bXi9d2jc94sFMOduSZNMpFc\_tp0](https://docs.google.com/document/d/1icOn6daEiFUF8x94bXi9d2jc94sFMOduSZNMpFc_tp0)

