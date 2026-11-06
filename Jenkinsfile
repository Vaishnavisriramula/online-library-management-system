
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

        stage('Run Selenium Tests') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    $env:HEADLESS = "true"
                    $env:PORT = "3100"
                    $env:BASE_URL = "http://127.0.0.1:3100"
                    $env:DB_PATH = Join-Path $env:WORKSPACE "library-ci.db"

                    $outputLog = Join-Path $env:WORKSPACE "ci-server-output.log"
                    $errorLog = Join-Path $env:WORKSPACE "ci-server-error.log"

                    if (Test-Path $env:DB_PATH) {
                        Remove-Item $env:DB_PATH -Force
                    }

                    $server = Start-Process -FilePath "node.exe" `
                        -ArgumentList "server.js" `
                        -WorkingDirectory $env:WORKSPACE `
                        -RedirectStandardOutput $outputLog `
                        -RedirectStandardError $errorLog `
                        -PassThru

                    try {
                        $ready = $false

                        for ($i = 0; $i -lt 30; $i++) {
                            if ($server.HasExited) {
                                throw "Application server stopped unexpectedly"
                            }

                            try {
                                $response = Invoke-WebRequest `
                                    -Uri "$env:BASE_URL/api/health" `
                                    -UseBasicParsing `
                                    -TimeoutSec 2

                                if ($response.StatusCode -eq 200) {
                                    $ready = $true
                                    break
                                }
                            }
                            catch {
                                Start-Sleep -Seconds 1
                            }
                        }

                        if (-not $ready) {
                            throw "Application server did not start"
                        }

                        Write-Host "Application server started successfully"
                        Write-Host "Running Selenium test cases..."

                        node tests/library.test.js

                        if ($LASTEXITCODE -ne 0) {
                            throw "Selenium tests failed"
                        }

                        Write-Host "All Selenium tests passed!"
                    }
                    finally {
                        if ($server -and -not $server.HasExited) {
                            Stop-Process -Id $server.Id -Force
                        }

                        if (Test-Path $outputLog) {
                            Get-Content $outputLog -Tail 20
                        }

                        if (Test-Path $errorLog) {
                            Get-Content $errorLog -Tail 20
                        }
                    }
                '''
            }
        }
    }

    post {
        success {
            echo 'Library Management CI/CD Pipeline SUCCESS!'
        }

        failure {
            echo 'Pipeline failed. Check Console Output.'
        }
    }
}
