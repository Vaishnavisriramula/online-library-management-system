
pipeline {
    agent any

    stages {
        stage('Checkout GitHub') {
            steps {
                echo 'Downloading project from GitHub...'
                checkout scm
            }
        }

        stage('Check Node.js') {
            steps {
                bat 'node --version'
                bat 'npm --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing project dependencies...'
                bat 'npm ci --include=dev'
            }
        }

        stage('Validate Application') {
            steps {
                echo 'Checking application files...'
                bat 'node --check server.js'
                bat 'node --check database.js'
                bat 'node --check tests/library.test.js'
            }
        }

        stage('Initialize Database') {
            steps {
                bat 'node database.js'
                echo 'Database initialized successfully'
            }
        }
    }

    post {
        success {
            echo 'Library Management CI validation successful!'
        }

        failure {
            echo 'Pipeline failed. Check the console output.'
        }
    }
}
