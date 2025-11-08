
export const gitignore = `
HELP.md
target/
.mvn/wrapper/maven-wrapper.jar
!**/src/main/**/target/
!**/src/test/**/target/

### STS ###
.apt_generated
.classpath
.factorypath
.project
.settings
.springBeans
.sts4-cache

### IntelliJ IDEA ###
.idea
*.iws
*.iml
*.ipr

### NetBeans ###
/nbproject/private/
/nbbuild/
/dist/
/nbdist/
/.nb-gradle/
build/
!**/src/main/**/build/
!**/src/test/**/build/

### VS Code ###
.vscode/
`

export const gitattributes = `
/mvnw text eol=lf
*.cmd text eol=crlf

`



export const mvnwCmd = `@ECHO OFF
@REM ----------------------------------------------------------------------------
@REM Apache Maven Wrapper startup script (Windows)
@REM Versión fija sin variables dinámicas
@REM ----------------------------------------------------------------------------

SET MAVEN_VERSION=3.9.6
SET MAVEN_DIST_DIR=.mvn\\wrapper\\apache-maven-%MAVEN_VERSION%

ECHO Starting Maven Wrapper (Windows)...
ECHO Using Maven version: %MAVEN_VERSION%

IF NOT EXIST .mvn\\wrapper\\maven-wrapper.properties (
  ECHO Cannot find .mvn\\wrapper\\maven-wrapper.properties
  EXIT /B 1
)

IF NOT EXIST "%MAVEN_DIST_DIR%" (
  ECHO Downloading Apache Maven %MAVEN_VERSION%...
  mkdir "%MAVEN_DIST_DIR%"
  powershell -Command "Invoke-WebRequest 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven-%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip' -OutFile '%MAVEN_DIST_DIR%\\maven.zip'"
  powershell -Command "Expand-Archive '%MAVEN_DIST_DIR%\\maven.zip' '%MAVEN_DIST_DIR%'"
)

CALL "%MAVEN_DIST_DIR%\\apache-maven-%MAVEN_VERSION%\\bin\\mvn.cmd" %*
`
