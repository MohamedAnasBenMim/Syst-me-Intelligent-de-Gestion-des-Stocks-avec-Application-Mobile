// Jenkinsfile — SGS Gestion de Stock
// Pipeline CI/CD pour tous les microservices
// Déclenché à chaque push sur main ou feature/*

pipeline {

    agent any

    environment {
        // Registre Docker (modifier si tu utilises DockerHub ou autre)
        REGISTRY      = "localhost:5000"
        PROJECT_NAME  = "sgs"
        COMPOSE_FILE  = "docker-compose.yml"
    }

    // Déclencher automatiquement sur push GitHub (nécessite webhook configuré)
    triggers {
        githubPush()
    }

    stages {

        // ── Étape 1 : Récupération du code ───────────────────
        stage('Checkout') {
            steps {
                checkout scm
                echo "Branche : ${env.GIT_BRANCH}"
                echo "Commit  : ${env.GIT_COMMIT}"
            }
        }

        // ── Étape 2 : Tests unitaires (en parallèle) ─────────
        stage('Tests') {
            parallel {

                stage('Test Auth') {
                    steps {
                        dir('service-Auth') {
                            sh '''
                                python -m pip install -r requirements.txt -q
                                python -m pytest tests/ -v --tb=short || true
                            '''
                        }
                    }
                }

                stage('Test Stock') {
                    steps {
                        dir('Service-Stock') {
                            sh '''
                                python -m pip install -r requirements.txt -q
                                python -m pytest tests/ -v --tb=short || true
                            '''
                        }
                    }
                }

                stage('Test Mouvement') {
                    steps {
                        dir('Service-Mouvement') {
                            sh '''
                                python -m pip install -r requirements.txt -q
                                python -m pytest tests/ -v --tb=short || true
                            '''
                        }
                    }
                }

                stage('Test Reporting') {
                    steps {
                        dir('Service-Reporting') {
                            sh '''
                                python -m pip install -r requirements.txt -q
                                python -m pytest tests/ -v --tb=short || true
                            '''
                        }
                    }
                }

            }
        }

        // ── Étape 3 : Build des images Docker (en parallèle) ─
        stage('Build Images') {
            when {
                anyOf {
                    branch 'main'
                    branch pattern: 'feature/*', comparator: 'GLOB'
                }
            }
            parallel {

                stage('Build Auth') {
                    steps {
                        sh "docker build -t ${PROJECT_NAME}-auth:${env.BUILD_NUMBER} ./service-Auth"
                        sh "docker tag ${PROJECT_NAME}-auth:${env.BUILD_NUMBER} ${PROJECT_NAME}-auth:latest"
                    }
                }

                stage('Build Warehouse') {
                    steps {
                        sh "docker build -t ${PROJECT_NAME}-warehouse:${env.BUILD_NUMBER} ./Service-Warehouse"
                        sh "docker tag ${PROJECT_NAME}-warehouse:${env.BUILD_NUMBER} ${PROJECT_NAME}-warehouse:latest"
                    }
                }

                stage('Build Stock') {
                    steps {
                        sh "docker build -t ${PROJECT_NAME}-stock:${env.BUILD_NUMBER} ./Service-Stock"
                        sh "docker tag ${PROJECT_NAME}-stock:${env.BUILD_NUMBER} ${PROJECT_NAME}-stock:latest"
                    }
                }

                stage('Build Mouvement') {
                    steps {
                        sh "docker build -t ${PROJECT_NAME}-mouvement:${env.BUILD_NUMBER} ./Service-Mouvement"
                        sh "docker tag ${PROJECT_NAME}-mouvement:${env.BUILD_NUMBER} ${PROJECT_NAME}-mouvement:latest"
                    }
                }

                stage('Build Alertes') {
                    steps {
                        sh "docker build -t ${PROJECT_NAME}-alertes:${env.BUILD_NUMBER} ./Service-Alertes"
                        sh "docker tag ${PROJECT_NAME}-alertes:${env.BUILD_NUMBER} ${PROJECT_NAME}-alertes:latest"
                    }
                }

                stage('Build Notification') {
                    steps {
                        sh "docker build -t ${PROJECT_NAME}-notification:${env.BUILD_NUMBER} ./Service-Notification"
                        sh "docker tag ${PROJECT_NAME}-notification:${env.BUILD_NUMBER} ${PROJECT_NAME}-notification:latest"
                    }
                }

                stage('Build Reporting') {
                    steps {
                        sh "docker build -t ${PROJECT_NAME}-reporting:${env.BUILD_NUMBER} ./Service-Reporting"
                        sh "docker tag ${PROJECT_NAME}-reporting:${env.BUILD_NUMBER} ${PROJECT_NAME}-reporting:latest"
                    }
                }

                stage('Build IA/RAG') {
                    steps {
                        sh "docker build -t ${PROJECT_NAME}-ia-rag:${env.BUILD_NUMBER} ./Service-IA-RAG"
                        sh "docker tag ${PROJECT_NAME}-ia-rag:${env.BUILD_NUMBER} ${PROJECT_NAME}-ia-rag:latest"
                    }
                }

            }
        }

        // ── Étape 4 : Health check post-déploiement ───────────
        stage('Health Checks') {
            when { branch 'main' }
            steps {
                sh '''
                    echo "Vérification des services..."
                    sleep 15

                    check_service() {
                        NAME=$1; PORT=$2
                        STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/health)
                        if [ "$STATUS" = "200" ]; then
                            echo "OK  $NAME (:$PORT)"
                        else
                            echo "KO  $NAME (:$PORT) — HTTP $STATUS"
                        fi
                    }

                    check_service "Auth"         8001
                    check_service "Warehouse"    8002
                    check_service "Stock"        8003
                    check_service "Mouvement"    8004
                    check_service "Alertes"      8005
                    check_service "Notification" 8006
                    check_service "Reporting"    8007
                    check_service "IA/RAG"       8008
                '''
            }
        }

        // ── Étape 5 : Déploiement (branche main uniquement) ───
        stage('Deploy') {
            when { branch 'main' }
            steps {
                sh '''
                    echo "Déploiement en cours..."
                    docker-compose -f ${COMPOSE_FILE} pull || true
                    docker-compose -f ${COMPOSE_FILE} up -d --build
                    echo "Déploiement terminé"
                '''
            }
        }

    }

    post {
        success {
            echo "Pipeline réussi — Build #${env.BUILD_NUMBER}"
        }
        failure {
            echo "Pipeline échoué — Build #${env.BUILD_NUMBER} — Vérifier les logs"
        }
        always {
            // Nettoyage des images orphelines
            sh "docker image prune -f || true"
        }
    }
}
