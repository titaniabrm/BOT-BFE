@echo off
echo ============================================
echo   Configuração Git para BFE Command System
echo ============================================
echo.

REM Verificar se estamos no diretório correto
if not exist "package.json" (
    echo ERRO: Não está no diretório do projeto!
    echo Execute este script dentro de "bfe-command-system"
    pause
    exit /b 1
)

echo [1/6] Limpando arquivos temporários...
rmdir /s /q node_modules 2>nul
rmdir /s /q .next 2>nul
del *.db 2>nul
del *.db-journal 2>nul
echo ✓ Arquivos temporários removidos
echo.

echo [2/6] Inicializando repositório Git...
git init
echo ✓ Repositório inicializado
echo.

echo [3/6] Configurando usuário Git...
set /p git_email="Digite seu email para Git: "
set /p git_name="Digite seu nome para Git: "
git config user.email "%git_email%"
git config user.name "%git_name%"
echo ✓ Usuário configurado
echo.

echo [4/6] Adicionando repositório remoto...
git remote add origin https://github.com/titaniabrm/BOT-BFE.git
echo ✓ Remote adicionado
echo.

echo [5/6] Adicionando arquivos e fazendo commit...
git add .
git commit -m "Initial commit: BFE Command System v1.1.0

Sistema integrado de gerenciamento de patentes Discord ↔ Roblox
Inclui:
- Dashboard web Next.js 14 com autenticação OAuth
- Bot Discord.js com comandos slash
- Sistema de sincronização Roblox ↔ Discord
- Painel administrativo com tema militar
- Banco de dados Prisma SQLite

Co-Authored-By: Claude Code <noreply@anthropic.com>"
echo ✓ Commit realizado
echo.

echo [6/6] Fazendo push para GitHub...
git branch -M main
git push -u origin main
echo.

if %errorlevel% equ 0 (
    echo ============================================
    echo   ✓ CONFIGURAÇÃO COMPLETA!
    echo ============================================
    echo.
    echo Repositório configurado e enviado para:
    echo https://github.com/titaniabrm/BOT-BFE.git
    echo.
    echo Agora siga as instruções em DEPLOYMENT_GUIDE.md
    echo para configurar Vercel e Railway.
) else (
    echo ============================================
    echo   ✗ ERRO NO PUSH!
    echo ============================================
    echo.
    echo Possíveis causas:
    echo 1. Token de autenticação necessário
    echo 2. Repositório já existe e precisa de force push
    echo 3. Problemas de rede
    echo.
    echo Execute manualmente: git push -u origin main --force
    echo (se quiser sobrescrever o repositório remoto)
)

pause