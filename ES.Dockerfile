FROM elasticsearch:8.13.0
RUN elasticsearch-plugin install -b https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v7.17.7/elasticsearch-analysis-ik-7.17.7.zip

COPY ./elasticsearch/synonym.txt /usr/share/elasticsearch/config/analysis/synonym.txt
COPY ./elasticsearch/stopwords.txt /usr/share/elasticsearch/config/analysis/stopwords.txt

USER elasticsearch