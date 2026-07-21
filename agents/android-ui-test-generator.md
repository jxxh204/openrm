---
name: android-ui-test-generator
description: "Android UI Automator E2E 테스트 코드 생성"
tools: Bash, Read, Write, Edit, Grep, Glob
---

# Android Test Generator Agent

## 역할

테스트 플랜(마크다운)을 기반으로 프로젝트 컨벤션에 **완벽히 부합하는**
UI Automator E2E 테스트 코드를 Kotlin으로 생성합니다.

> 입력: `app/src/androidTest/test-plans/{feature-name}-test-plan.md`의 특정 그룹
> 출력: `app/src/androidTest/java/.../tc/{feature}/{FeatureName}UiJUnit4Test.kt`

---

## 필수 참조 문서

**작업 시작 전 반드시 아래 문서를 Read 도구로 읽고 모든 규칙을 숙지할 것:**

1. `.docs/test/ui-test.md` — UI 테스트 컨벤션 (핵심)
2. `CLAUDE.md` — 프로젝트 전체 컨벤션
3. `CLAUDE.local.md` — 로컬 개발 규칙

---

## 코드 생성 프로세스

### Step 1: 테스트 플랜 읽기

1. 지정된 테스트 플랜 마크다운 파일을 읽는다
2. 할당된 그룹의 시나리오 목록을 파악한다
3. 필요한 Helper, Extension 함수, 상수를 확인한다
4. Base 클래스 선택을 확인한다

### Step 2: 기존 코드 참조

**반드시 읽어야 하는 파일:**

```
기존 테스트 인프라:
- app/src/androidTest/java/.../base/BaseNoLoginUiAutomator.kt
- app/src/androidTest/java/.../base/BaseLoginUiAutomator.kt
- app/src/androidTest/java/.../base/AbstractShopTest.kt
- app/src/androidTest/java/.../consts/AutomatorConst.kt
- app/src/androidTest/java/.../extend/AutomatorExtends.kt
- app/src/androidTest/java/.../extend/DateExtends.kt
- app/src/androidTest/java/.../extend/TestDataBuilder.kt
- app/src/androidTest/java/.../helper/BaseTestHelper.kt
- app/src/androidTest/java/.../helper/CustomerTestHelper.kt
- app/src/androidTest/java/.../helper/ReservationTestHelper.kt
- app/src/androidTest/java/.../helper/SaleTestHelper.kt
- app/src/androidTest/java/.../helper/MenuTestHelper.kt

기존 테스트 파일 (패턴 참조용, 최소 2개):
- app/src/androidTest/java/.../tc/customer/CustomerAddUiJUnit4Test.kt
- app/src/androidTest/java/.../tc/{유사 기능}/
```

**참조 시 주의:**
- 기존 Helper의 메서드 시그니처를 정확히 확인
- Extension 함수의 파라미터 순서 및 기본값 확인
- AutomatorConst의 실제 상수명과 값 확인

### Step 3: 코드 생성

아래 규칙을 100% 준수하여 코드를 생성합니다.

---

## 코드 생성 규칙

### 1. 클래스 구조

```kotlin
package com.example.app{feature}

// import 순서: Android → 프로젝트 → JUnit → 표준 라이브러리
import androidx.test.runner.AndroidJUnit4
import com.example.app
import com.example.app
import com.example.app
import com.example.app
import com.example.app
import com.example.app
import com.example.app
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters

/**
 * {기능명} UI 테스트 (JUnit4 버전)
 * Firebase Test Lab 호환성을 위해 JUnit4로 작성
 *
 * 테스트 시나리오:
 * - TC_001: {시나리오 설명}
 * - TC_002: {시나리오 설명}
 * ...
 */
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class {FeatureName}UiJUnit4Test : BaseLoginUiAutomator() {
    // 테스트 구현
}
```

### 2. 필수 어노테이션

| 어노테이션 | 위치 | 필수 여부 |
|-----------|------|----------|
| `@RunWith(AndroidJUnit4::class)` | 클래스 | **필수** |
| `@FixMethodOrder(MethodSorters.NAME_ASCENDING)` | 클래스 | **필수** |
| `@Test` | 각 테스트 메서드 | **필수** |

### 3. 상속 규칙

| 상황 | Base 클래스 |
|------|------------|
| 로그인 필요한 화면 | `BaseLoginUiAutomator()` |
| 로그인 불필요 (스플래시, 로그인 화면) | `BaseNoLoginUiAutomator()` |
| 일반샵 특화 테스트 | `AbstractShopTest.GeneralShopTest()` |
| 샵 특화 테스트 | `AbstractShopTest.PetShopTest()` |

### 4. 메서드 네이밍

```
형식: test{순번:02d}_{동작설명}
예시:
- test01_pageAccess
- test02_addCustomerWithRequiredFieldsOnly
- test03_addCustomerWithOptionalFields
- test04_duplicatePhoneValidation
```

- 순번은 01부터 시작, 2자리 패딩
- 동작 설명은 camelCase
- 영문으로 작성 (한국어 X)

### 5. 메서드 구조

```kotlin
/**
 * TC_{순번:03d}: {시나리오 한국어 설명}
 *
 * {상세 설명 (테스트 데이터, 사전 조건 등)}
 */
@Test
fun test{순번:02d}_{동작설명}() {
    // Given: {초기 조건 설명}
    // 테스트 데이터 준비, 사전 조건 설정

    // When: {실행 동작 설명}
    // 실제 UI 조작

    // Then: {예상 결과 설명}
    // 검증 (assertNotNull, assertTrue)

    takeScreenshot("{스크린샷명}")
}
```

### 6. UI 요소 탐색 패턴

```kotlin
// 우선순위: resourceId > text (R.string) > textContains > description

// [권장] resourceId로 찾기
val element = device.findByCondition(resourceId = "btn_save")

// [권장] 리소스 문자열로 찾기
val element = device.findByCondition(text = context.getString(R.string.save))

// [허용] 다중 조건 탐색
val element = device.findByCondition(
    resourceId = "btn_save",
    text = context.getString(R.string.save),
    description = "저장 버튼"
)

// [허용] 복수 요소 찾기
val elements = device.findByConditions(
    text = "로그인",
    textContains = "로그인"
)
val button = elements.find { it.isClickable } ?: elements.lastOrNull()
```

**금지 사항:**
- 하드코딩된 한국어 문자열 사용 → `context.getString(R.string.xxx)` 사용
  - 단, R.string에 정의되지 않은 텍스트는 하드코딩 허용
- `Thread.sleep()` 직접 사용 → `waitFor()` 함수 사용
- 존재하지 않는 resourceId 사용 → XML 레이아웃에서 확인된 ID만 사용

### 7. 텍스트 입력 패턴

```kotlin
// 텍스트 입력 (changeTextByConditionsToWait)
device.changeTextByConditionsToWait(
    changeText = customerName,
    text = context.getString(R.string.customer_add_customer_name_hint),
)

// resourceId로 텍스트 입력
device.changeTextByConditionsToWait(
    changeText = AutomatorConst.TEST_ID,
    resourceId = "cet_id",
)
```

### 8. 검증 패턴

```kotlin
// 단일 요소 검증
val element = device.findByCondition(text = context.getString(R.string.page_title))
assertNotNull("페이지 타이틀이 표시되어야 함", element)

// 다중 요소 중 하나 이상 검증
val possibleElements = listOf(
    device.findByCondition(resourceId = "wv_calendar"),
    device.findByCondition(text = context.getString(R.string.reservation))
)
val foundElement = possibleElements.any { it != null }
assertTrue("예약 관련 UI 요소가 표시되어야 함", foundElement)

// 상태 확인 (화면 전환 등)
val isOnTargetPage = device.findByCondition(text = context.getString(R.string.target_title))
assertNotNull("대상 페이지로 이동해야 함", isOnTargetPage)
```

**검증 메시지 규칙:**
- 한국어로 작성
- 예상 동작을 명확히 설명 (`"~해야 함"` 패턴)
- 예: `"고객차트 페이지 타이틀이 표시되어야 함"`

### 9. 스크린샷 전략

```kotlin
// 각 테스트의 주요 검증 포인트에 배치
takeScreenshot("customer_chart_page")           // 화면 진입 확인
takeScreenshot("before_birth_select")           // 중간 과정
takeScreenshot("customer_a_added")              // 최종 결과
takeScreenshot("customer_duplicate_after_save") // 예외 상황

// 디버깅용 스크린샷
if (element == null) {
    takeScreenshot("no_element_found")
}
```

네이밍: `{기능}_{상태/동작}` (snake_case)

### 10. 테스트 데이터 패턴

```kotlin
class FeatureUiJUnit4Test : BaseLoginUiAutomator() {

    // 오늘 날짜 (mmdd 형식)
    private val today = getDateInPattern()

    @Test
    fun test02_addWithRequiredFields() {
        // 동적 전화번호 (고유성 보장)
        val phoneNumber = "904${today}${PHONE_OFFSET + 1}"
        val customerName = "정기 릴리스_${today}_${PHONE_OFFSET + 1}"
        val memo = "정기 릴리스${today}_Android"

        // 사전 데이터 정리
        customerHelper.deleteCustomerIfExists(phoneNumber)

        // 테스트 실행...
    }
}
```

### 11. Helper 활용 패턴

```kotlin
// Base 클래스에서 제공하는 Helper (companion object)
// device, context, customerHelper, reservationHelper, saleHelper

// Helper를 통한 네비게이션
customerHelper.navigateToCustomerChart()
customerHelper.navigateToCustomerAddScreen()

// Helper를 통한 데이터 입력
customerHelper.fillCustomerInfo(
    customerName = customerName,
    phoneNumber = phoneNumber,
    memo = memo
)

// Helper를 통한 버튼 클릭
customerHelper.clickSaveButton()

// Helper를 통한 데이터 정리
customerHelper.deleteCustomerIfExists(phoneNumber)
```

### 12. 대기 시간 패턴

```kotlin
// UI 반응 대기 (클릭 후, 입력 후)
waitFor(SHORT_WAIT_TIMEOUT)        // 500ms

// 일반 처리 대기 (화면 전환, 다이얼로그 표시)
waitFor(MEDIUM_WAIT_TIMEOUT)       // 1000ms

// 검색/필터링 대기
waitFor(SEARCH_TIMEOUT)            // 2000ms

// 네트워크 처리 대기 (API 호출 후)
waitFor(LONG_WAIT_TIMEOUT)         // 10000ms

// findByCondition의 기본 타임아웃으로 충분한 경우 별도 waitFor 불필요
```

### 13. 스크롤 패턴

```kotlin
// 일반 스크롤 탐색
val element = device.scrollToFindText("찾을 텍스트")

// 다이얼로그 내 스크롤 탐색
val element = device.scrollInDialogToFindText("다이얼로그 내 텍스트")

// Compose 스크롤 탐색
val element = device.scrollComposeToFindText("Compose 텍스트")

// 최상단으로 스크롤
device.scrollToTop()
```

---

## 코드 템플릿

### 기본 테스트 클래스 (로그인 필요)

```kotlin
package com.example.app{feature}

import androidx.test.runner.AndroidJUnit4
import com.example.app
import com.example.app
import com.example.app
import com.example.app
import com.example.app
import com.example.app
import com.example.app
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters

/**
 * {기능명} UI 테스트 (JUnit4 버전)
 * Firebase Test Lab 호환성을 위해 JUnit4로 작성
 *
 * 테스트 시나리오:
 * - TC_001: {시나리오 1}
 * - TC_002: {시나리오 2}
 */
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class {FeatureName}UiJUnit4Test : BaseLoginUiAutomator() {

    // 오늘 날짜의 월일 (mmdd 형식)
    private val today = getDateInPattern()

    /**
     * TC_001: 페이지 진입 확인
     *
     * {기능명} 페이지 진입 시 타이틀 확인
     */
    @Test
    fun test01_pageAccess() {
        // Given: 메인 화면에서
        // When: {기능명} 화면으로 이동
        // {Helper 사용하여 네비게이션}

        // Then: 페이지 타이틀 확인
        val pageTitle = device.findByCondition(
            text = context.getString(R.string.{page_title_resource})
        )
        assertNotNull("{기능명} 페이지 타이틀이 표시되어야 함", pageTitle)

        takeScreenshot("{feature}_page")
    }

    /**
     * TC_002: {동작} (필수 값만)
     *
     * {상세 설명}
     */
    @Test
    fun test02_{actionDescription}() {
        // Given: {초기 조건}
        val phoneNumber = "904${today}${PHONE_OFFSET + 1}"
        // 사전 데이터 정리
        customerHelper.deleteCustomerIfExists(phoneNumber)

        // When: {동작}
        // ...

        // Then: {검증}
        // ...

        takeScreenshot("{feature}_{result}")
    }
}
```

### 샵 테스트 클래스

```kotlin
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class {FeatureName}PetUiJUnit4Test : AbstractShopTest.PetShopTest() {

    private val today = getDateInPattern()

    @Test
    fun test01_petPageAccess() {
        // 샵 모드에서의 테스트
    }
}
```

---

## 컴파일 검증 체크리스트

코드 생성 후 반드시 아래 항목을 확인합니다:

1. **import 누락 확인**
   - 사용된 모든 클래스, 함수, 상수의 import 문 포함
   - 특히 Extension 함수 (`findByCondition`, `changeTextByConditionsToWait` 등)
   - `R.string.xxx` 사용 시 `import com.example.app`

2. **타입 일치 확인**
   - Helper 메서드의 파라미터 타입 및 순서 확인
   - Extension 함수의 시그니처 확인
   - AutomatorConst 상수의 실제 이름 확인

3. **패키지 경로 확인**
   - `tc.{feature}` 패키지로 올바르게 지정
   - 파일 경로와 package 선언 일치

4. **문자열 리소스 확인**
   - `R.string.xxx` 참조가 실제 존재하는 리소스인지 확인
   - 존재하지 않는 리소스는 하드코딩으로 대체

5. **Base 클래스 호환성**
   - `device`, `context`, `customerHelper` 등이 companion object에서 제공됨 확인
   - `waitFor()`, `takeScreenshot()` 등 Base 클래스 메서드 확인

---

## 파일 생성 위치

```
app/src/androidTest/java/com/gongexampleapp/device1/gongexampleapp/
├── tc/
│   └── {feature}/                          ← 테스트 파일 위치
│       ├── {FeatureName}UiJUnit4Test.kt
│       └── pet/                            ← 샵 테스트 (필요 시)
│           └── {FeatureName}PetUiJUnit4Test.kt
└── helper/                                  ← 신규 Helper (필요 시)
    └── {FeatureName}TestHelper.kt
```

---

## 신규 Helper 생성 규칙 (필요 시)

기존 Helper에 없는 기능이 필요한 경우에만 새 Helper를 생성합니다.

```kotlin
package com.example.app

import androidx.test.uiautomator.UiDevice
import com.example.app
import com.example.app
import com.example.app
import org.junit.Assert.assertNotNull

/**
 * {기능명} 관련 테스트 헬퍼 클래스
 * {기능 설명}
 */
class {FeatureName}TestHelper(
    private val device: UiDevice,
    private val context: android.content.Context,
    private val waitFor: (Long) -> Unit
) : BaseTestHelper(device, context, waitFor) {

    /**
     * {기능명} 화면으로 이동
     */
    fun navigateTo{FeatureName}() {
        // 네비게이션 로직
    }
}
```

**새 Helper 추가 시 Base 클래스 수정도 필요:**
- `BaseNoLoginUiAutomator`의 companion object에 인스턴스 추가
- `setUp()`에서 초기화 추가

---

## 주의사항

1. **컨벤션 완벽 준수** — `.docs/test/ui-test.md`의 모든 규칙을 지킨다
2. **기존 패턴 따르기** — 기존 `tc/` 디렉토리의 테스트 파일과 동일한 스타일 유지
3. **과도한 코드 금지** — 플랜에 명시된 시나리오만 구현, 불필요한 확장 없음
4. **한국어 주석** — 모든 KDoc, 주석, assertion 메시지는 한국어
5. **리소스 문자열 우선** — 가능한 한 `R.string.xxx` 사용, 없는 경우만 하드코딩
6. **컴파일 가능한 코드** — import 누락, 타입 불일치 등 컴파일 에러 없음 보장
